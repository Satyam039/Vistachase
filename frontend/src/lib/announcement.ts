// Site announcement (components/layout/AnnouncementBar.tsx). Plain module so the root layout (a
// server component) can inline ANNOUNCE_SCRIPT. Change `id` when the message changes so everyone
// sees the new one, even if they closed the old one.

export const ANNOUNCEMENT = { id: "moraine-road-2026", storageKey: "vc-announcement-closed" };

/** Runs in <head> before paint: hides the bar if this announcement was closed on this device. */
export const ANNOUNCE_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(ANNOUNCEMENT.storageKey)})===${JSON.stringify(ANNOUNCEMENT.id)})document.documentElement.setAttribute("data-announce-closed","")}catch(e){}`;
