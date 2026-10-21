import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { MeetingsPanelLayout } from './meetings-panel.layout';
import { HomeStateService } from '../../pages/home/home-state.service';
import { createHomeServiceMocks, provideHomeServiceMocks } from '../../pages/home/testing/home-testing';

describe('MeetingsPanel VM and bot progress', () => {
  let mocks: ReturnType<typeof createHomeServiceMocks>;
  let component: MeetingsPanelLayout;
  let fixture: ReturnType<typeof TestBed.createComponent<MeetingsPanelLayout>>;
  let state: HomeStateService;
  beforeEach(async () => {
    mocks = createHomeServiceMocks();
    mocks.zoom.getVm.and.returnValue(of({ name: 'zoom-bot-vm', status: 'TERMINATED' }));
    await TestBed.configureTestingModule({ imports: [MeetingsPanelLayout], providers: [HomeStateService, ...provideHomeServiceMocks(mocks)] }).compileComponents();
    fixture = TestBed.createComponent(MeetingsPanelLayout); component = fixture.componentInstance;
    state = TestBed.inject(HomeStateService); fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());
  const ready = () => { component.vmStatus.set('RUNNING'); component.agentReady.set(true); };

  it('checks VM status on init but never starts or stops it automatically', () => {
    expect(mocks.zoom.getVm).toHaveBeenCalledTimes(1);
    expect(component.vmStatus()).toBe('TERMINATED');
    expect(component.vmButtonLabel).toBe('Encender VM');
    expect(mocks.zoom.startVm).not.toHaveBeenCalled(); expect(mocks.zoom.stopVm).not.toHaveBeenCalled();
  });
  it('waits for RUNNING and agent readiness before reporting startup completion', fakeAsync(() => {
    mocks.zoom.getVm.and.returnValues(of({ status: 'RUNNING' }), of({ status: 'RUNNING' }));
    mocks.zoom.getReadiness.and.returnValues(throwError(() => ({ status: 503 })), of({ status: 'ready' }));
    component.toggleVm(); flushMicrotasks();
    expect(component.vmBusy()).toBeTrue(); expect(component.agentReady()).toBeFalse();
    expect(component.controlMessage()).toContain('esperando al agente');
    tick(3000); flushMicrotasks();
    expect(component.vmBusy()).toBeFalse(); expect(component.agentReady()).toBeTrue();
    expect(component.vmButtonLabel).toBe('Detener VM'); expect(component.controlMessage()).toContain('agente listo');
    tick(6000); expect(component.controlMessage()).toBe('');
  }));
  it('checks shutdown completion, clears bot state and hides the final message', fakeAsync(() => {
    ready(); state.botId = 'bot123'; mocks.zoom.getVm.and.returnValue(of({status:'TERMINATED'}));
    component.toggleVm(); flushMicrotasks();
    expect(mocks.zoom.stopVm).toHaveBeenCalledTimes(1); expect(state.botId).toBe('');
    expect(component.vmButtonLabel).toBe('Encender VM'); expect(component.controlMessage()).toBe('VM detenida.');
    tick(6000); expect(component.controlMessage()).toBe('');
  }));
  it('keeps joining visible after 202 and marks the bot ready only when its operation succeeds', fakeAsync(() => {
    ready(); component.meetings = [{id:'m1', number:'123456789'}]; component.selectMeeting('m1');
    mocks.zoom.getOperation.and.returnValues(of({status:'running'}), of({status:'succeeded'}));
    component.createBot(); flushMicrotasks(); tick(0);
    expect(component.botAction()).toBe('join'); expect(component.botConnected()).toBeFalse();
    expect(component.controlMessage()).toContain('Conectando'); expect(state.botId).toBe('bot123');
    tick(2000); flushMicrotasks();
    expect(component.botConnected()).toBeTrue(); expect(component.botAction()).toBeNull();
    expect(component.controlMessage()).toContain('se unió'); tick(6000); expect(component.controlMessage()).toBe('');
  }));
  it('shows the join failure and clears a bot only when cleanup is confirmed', fakeAsync(() => {
    ready(); component.meetings = [{id:'m1', number:'123456789'}]; component.selectMeeting('m1');
    mocks.zoom.getOperation.and.returnValue(of({status:'failed', error:{code:'OPERATION_TIMEOUT'}}));
    mocks.zoom.getBot.and.returnValue(of({status:'failed',resource_released:true}));
    component.createBot(); flushMicrotasks(); tick(0); flushMicrotasks();
    expect(component.controlMessage()).toContain('OPERATION_TIMEOUT'); expect(state.botId).toBe('');
    expect(component.botConnected()).toBeFalse(); tick(12000);
  }));
  it('does not lose bot ID when leave fails', fakeAsync(() => {
    ready(); state.botId='bot123'; mocks.backend.removeBot.and.returnValue(throwError(() => new Error('request failed')));
    component.removeBot(); flushMicrotasks();
    expect(state.botId).toBe('bot123'); expect(component.controlError()).toBeTrue(); tick(12000);
  }));
  it('reports Compute Engine operation errors without a false success', fakeAsync(() => {
    mocks.zoom.startVm.and.returnValue(of({status:'TERMINATED',operation:{name:'op',status:'DONE',error:'QUOTA_EXCEEDED'}}));
    component.toggleVm(); flushMicrotasks();
    expect(component.controlMessage()).toContain('QUOTA_EXCEEDED'); expect(component.vmBusy()).toBeFalse(); tick(12000);
  }));
  it('prevents duplicate clicks and stops polling when destroyed', fakeAsync(() => {
    const reply = new Subject<any>(); mocks.zoom.startVm.and.returnValue(reply);
    component.toggleVm(); component.toggleVm(); expect(mocks.zoom.startVm).toHaveBeenCalledTimes(1);
    reply.next({status:'PROVISIONING'}); flushMicrotasks();
    const calls=mocks.zoom.getVm.calls.count(); fixture.destroy(); tick(10000);
    expect(mocks.zoom.getVm.calls.count()).toBe(calls);
  }));
  it('loads active bots on initial RUNNING state and restores the first bot', fakeAsync(() => {
    const bots = { items: [{ bot_id: 'first', status: 'active' as const, created_at: null }, { bot_id: 'second', status: 'active' as const, created_at: null }], next_cursor: null };
    mocks.zoom.getVm.and.returnValue(of({ status: 'RUNNING' }));
    mocks.zoom.listBots.and.returnValue(of(bots));
    component.ngOnInit(); flushMicrotasks();
    expect(mocks.zoom.listBots).toHaveBeenCalledOnceWith({ status: 'active' });
    expect(component.initialBots()).toEqual(bots);
    expect(state.botId).toBe('first');
    expect(component.botConnected()).toBeTrue();
    expect(mocks.backend.setConfig).toHaveBeenCalledWith(jasmine.objectContaining({ botId: 'first' }));
    component.refreshVm(); flushMicrotasks();
    expect(mocks.zoom.listBots).toHaveBeenCalledTimes(1);
  }));

  it('does not list bots when the initial VM is off', () => {
    expect(mocks.zoom.listBots).not.toHaveBeenCalled();
  });

  it('keeps the bot ID when the initial active bot list is empty', fakeAsync(() => {
    state.botId = 'existing';
    mocks.zoom.getVm.and.returnValue(of({ status: 'RUNNING' }));
    component.ngOnInit(); flushMicrotasks();
    expect(state.botId).toBe('existing');
  }));

  it('reports bot listing errors without changing the VM status or bot ID', fakeAsync(() => {
    state.botId = 'existing';
    mocks.zoom.getVm.and.returnValue(of({ status: 'RUNNING' }));
    mocks.zoom.listBots.and.returnValue(throwError(() => new Error('LIST_FAILED')));
    component.ngOnInit(); flushMicrotasks();
    expect(component.vmStatus()).toBe('RUNNING');
    expect(state.botId).toBe('existing');
    expect(component.controlMessage()).toContain('LIST_FAILED');
    tick(12000);
  }));

});
