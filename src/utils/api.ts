export type VideoItem = {
    name: string;
    publicUrl: string;
    size: number;
    updated?: string;
    duration?: number; // se llena en cliente
};

export async function getVideos(): Promise<VideoItem[]> {
    const res = await fetch("/videos");
    if (!res.ok) throw new Error(`Error /videos: ${res.status}`);
    return res.json();
}

export async function createBot(meeting_url: string, bot_name?: string) {
    const res = await fetch("/recall/create-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting_url, bot_name })
    });
    if (!res.ok) throw new Error(await safeText(res));
    return res.json() as Promise<{ id: string } & Record<string, unknown>>;
}

export async function outputMedia(bot_id: string, url: string) {
    const res = await fetch("/recall/output-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id, url })
    });
    if (!res.ok) throw new Error(await safeText(res));
    return res.json();
}

export async function stopMedia(bot_id: string) {
    const res = await fetch(`/recall/output-media?bot_id=${encodeURIComponent(bot_id)}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(await safeText(res));
    return res.json();
}

async function safeText(res: Response) {
    try { return await res.text(); } catch { return `${res.status}`; }
}
