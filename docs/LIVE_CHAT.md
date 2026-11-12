# Live chat with a live agent

"Chat with a live agent" in the AI concierge opens a real-time chat between the guest and the
support team. Code: `backend/src/modules/support/live-chat.ts` (chats), `staff-alerts.ts` (phone
alerts), `frontend/src/components/voice/LiveChatWindow.tsx` (guest), `components/admin/staff/LiveChatPanel.tsx`
and `LiveChatAlerts.tsx` (staff). Migration `9i_live_chat` adds the `LiveChat` and `LiveChatMessage` tables.

## How it works

1. The guest taps **Chat with a live agent**, gives a name and email and taps **Start live chat**. The
   concierge conversation is copied into the chat (card numbers redacted).
2. The team is alerted at once:
   - **Phone push** (optional, free): Telegram and/or ntfy, with a link to the chat.
   - **Email** to the support inbox (`SUPPORT_HANDOFF_TO`, default support@vistachase.com) with the link.
   - **Every admin page**: a "guest waiting in live chat" button, a chime, the count in the tab title,
     and a browser notification once staff click **Turn on chat alerts** (browsers only offer
     notifications on https or localhost).
3. An agent opens **Admin → Live chat** (phone or computer), picks the chat and replies. The guest sees
   "You're chatting with <first name>". Both sides refresh every few seconds.
4. Either side can end the chat. Each chat is also saved in **Admin → Messages** as an enquiry, so if
   nobody answers (or it's outside 6 a.m. – 9 p.m. MT, which the guest is told), the team replies by email.

Only the guest's browser holds the chat's token (only its hash is stored); a reload resumes the chat.
If `NEXT_PUBLIC_CRISP_WEBSITE_ID` is set, the button opens Crisp instead.

## Phone alerts setup (server `.env`, then restart the API)

**Telegram** (recommended):
1. In Telegram, message **@BotFather** → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Each agent opens the new bot and taps **Start** (or add the bot to a team group and send a message).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy each `chat.id` into
   `TELEGRAM_CHAT_ID` (comma-separated for several people; group ids start with `-`).

**ntfy** (no account): install the ntfy app, subscribe to a long random topic such as
`vistachase-live-8f3k29xq`, and set `NTFY_TOPIC_URL=https://ntfy.sh/vistachase-live-8f3k29xq`.
Anyone who knows the topic can read alerts, so keep it random; alerts carry only the guest's first
message and name, never email or phone.

Admin → Live chat shows which phone channels are set up.
