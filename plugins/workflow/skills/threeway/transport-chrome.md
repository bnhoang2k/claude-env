# threeway browser layer: ChatGPT in Claude in Chrome

How Claude reads and posts in a ChatGPT chat through the Claude in Chrome tools
(`mcp__claude-in-chrome__*`). The protocol does not depend on this file; another browser
layer could replace it.

## Page facts

Probed 2026-11-27 in a ChatGPT project chat (second probe, read-only):

- `data-conversation-role` (`user` or `assistant`) sits on a hidden `H4` heading, not on the
  message. The message is the largest ancestor of that heading that holds no other role
  heading. Reading `[data-conversation-role]` alone finds no content.
- `data-talvt-turn-state` (`complete` when finished) sits on a container that holds a user
  message and the assistant reply together. A message takes its state from the nearest one
  above it.
- An assistant message carries one `data-chatgpt-selection-message-id` (a UUID, the same
  value as `data-dil-message-id`). A user message has none; its ID is the UUID in
  `data-chatgpt-search-message-ids`. The assistant's `data-chatgpt-search-message-ids`
  holds two UUIDs (one is its selection ID), so use the selection ID first.
- `data-turn-key` sits higher up, around more than one message. Do not use it as a message.
- ChatGPT may rename a chat by itself after a later turn. A title Claude set can be
  overwritten; `check` sets it back.
- The message box is a rich editor. Typing `1. ` starts an auto-numbered list, so typed
  numbers doubled. Never type long or structured text by hand.
- Long answers can appear as `data-client-defined-widget="writing_block"` blocks.
- Projects open from the sidebar's "..." menu. A "Space" button in the sidebar is team
  onboarding, not projects.
- Seen 2026-11-27 in a temporary chat: a long user message shows only its first ~10,000
  characters behind "Show more", and the rest is not in the page at all (`innerText` and
  `textContent` both stop there). Turns far from the screen are taken out of the page too, so
  a read sees only the turns near the scroll position. Never size a chat from the page.
- Text put in the message box with `document.execCommand('insertText', …)` stayed as text at
  40,308 characters; it did not turn into an attached file. The send button is
  `button[aria-label="Send"]`, and a reply is still streaming while a button whose label holds
  "Stop" shows.

Not yet seen: how an intelligenceUI graphic appears in the page.

## Reading turns

1. Scroll the transcript to the top, then down in steps, running the snippet below at each
   step. Merge the results by `message_id`; a later read of the same turn replaces the
   earlier one (its state may have gone from streaming to complete).
2. Save the merged list as a JSON file and pass it to `threeway.py ingest`.

Run with `javascript_tool`. It returns the turns file shape that `ingest` reads:

```js
(() => {
  const ROLE = '[data-conversation-role]';
  const unitOf = (h) => {  // the largest ancestor holding only this role heading
    let u = h;
    while (u.parentElement && u.parentElement.querySelectorAll(ROLE).length === 1) u = u.parentElement;
    return u;
  };
  const attr = (u, n) => u.getAttribute(n) || u.querySelector(`[${n}]`)?.getAttribute(n) || null;
  // ChatGPT renders a fenced block as `code.CodeContent-…` in plain divs; older pages used `pre`.
  const CODE = 'pre, code[class*="CodeContent"]';
  const blocksOf = (u) => {
    const all = [...u.querySelectorAll(CODE)];
    return all.filter(el => !all.some(o => o !== el && o.contains(el)));  // drop nested duplicates
  };
  const langOf = (el, u) => {
    const code = el.matches('code') ? el : el.querySelector('code');
    const dl = el.getAttribute('data-language') || code?.getAttribute('data-language');
    if (dl) return dl.toLowerCase();  // a user turn: `pre > code[data-language]`, no header label
    const cls = [...(code?.classList || [])].find(c => c.startsWith('language-'));
    if (cls) return cls.slice('language-'.length);
    // The label is text above the code: the nearest ancestor with any text before the code has it.
    for (let a = el.parentElement; a && u.contains(a); a = a.parentElement) {
      const r = document.createRange();
      r.setStart(a, 0);
      r.setEndBefore(el);
      const before = r.toString().trim();
      if (before) return before.split(/\s/)[0].toLowerCase();
    }
    return '';
  };
  return [...document.querySelectorAll(ROLE)].map(h => {
    const u = unitOf(h);
    return {
      role: h.getAttribute('data-conversation-role'),
      message_id: attr(u, 'data-chatgpt-selection-message-id')
        || (attr(u, 'data-chatgpt-search-message-ids') || '').split(/\s+/)[0] || null,
      state: h.closest('[data-talvt-turn-state]')?.getAttribute('data-talvt-turn-state') || 'unknown',
      chars: u.innerText.length,  // for TW size; a long user turn shows only its first ~10,000
      blocks: blocksOf(u).map(el => ({
        lang: langOf(el, u),
        text: (el.querySelector('code') || el).innerText,
        in_quote: !!el.closest('blockquote'),
      })),
    };
  });
})()
```

A turn whose state is not `complete` is reported as incomplete and read again next time. If
every turn comes back `unknown`, or any `message_id` is null, the selectors have changed: stop, tell the user, and fix
this file before trusting any read.

## Posting

Checks before every post:

1. The last turn is complete and no stop button shows. If ChatGPT is still answering, wait
   or keep the post queued.
2. The message box is empty. If it holds text, the user is typing: do not post. Keep the
   post file, tell the user, and post on their next message.

Then:

1. Type only a short `[Claude] ...` line into the message box.
2. Attach the full post (readable text and `threeway` blocks) as a `.md` file, plus evidence
   images, with `file_upload`. Name files by their labels (`RES-001.md`, `EV-003.png`).
3. Read the message box back. It must hold exactly the `[Claude]` line and show the
   attachments. Then send.

Fallbacks, in order, if the upload does not reach ChatGPT or ChatGPT cannot read the file:

1. Synthetic paste: dispatch a `paste` event with the post text on the message box (pasted
   text skips the auto-list rules that typing triggers). Read the box back before sending.
2. Write the post to a file and ask the user to paste it.

## Title

After ChatGPT's first reply, set the chat title to `<repo> · <task> · <YYYY-MM-DD>` (the
`title` from `threeway.py init`) through the chat's rename menu. On each `check`, compare
the page title with the state's title and set it back if ChatGPT changed it.

## Figure capture

Take an image figure from the page source (the exact file) and a drawn figure by screenshot.
Seen 2026-11-27 on the first live run: screenshots alone cut off 3 of 13 figures (taller than
the visible area), and none was lost.

1. Scroll the turn into view first. ChatGPT removes turns far from the scroll position from
   the page, figures included, and `scrollHeight` changes as you scroll, so saved scroll
   positions fail. Run one `javascript_tool` call per figure or per half of the chat: a call
   times out at about 45 s.
2. Find the `Figure VIS-nnn` caption (a `span` inside `div.DilRenderer-…`). The visual is the
   caption's previous sibling, climbing at most about 5 parents. Do not take the first `img`
   found walking up: that can be a stray image from earlier in the turn.
3. An image figure is an `img.Image-…` whose `src` is
   `https://images.openai.com/static-rsc-4/<token>?purpose=inline` (about 225 characters).
   Download the full `src` (a copy cut short returns HTTP 500). It gives the original file at
   `naturalWidth` × `naturalHeight`.
4. A user-uploaded image is `img[alt="User attachment"]` with a `blob:` `src`. In the page:
   `fetch(blob)` → base64 → `navigator.clipboard.writeText`. Then
   `LC_ALL=en_US.UTF-8 pbpaste | base64 -d > file`. The bytes match the original.
5. A drawn figure (a `div.Box-…` with `data-d-component` attributes, HTML text, at most an
   icon `svg`, no `img` or `canvas`) is not a file. Save a region screenshot with `computer`
   `zoom` (`save_to_disk`); a figure taller than the window gets several shots,
   `VIS-nnn-1.png`, …. The source gives the text and structure for the `Text equivalent:` line;
   only the screenshot gives the look.
6. Copy each file into the session's `figures/` and record it with `threeway.py figure`, with
   the caption and the `Text equivalent:` line.
7. A visual that cannot be captured is recorded with `--failed "<why>"`, never skipped.

## Project instructions

Open the project page, then "Project actions" (the "..." button by Share) → "Project
settings". The "Instructions" textbox holds the text. Filling it with `form_input` sets the
value but not the page's state, so no Save button shows and closing drops the text. After the
fill, focus the textbox at its end, type one space and press Backspace: a Save button
appears. Click it. To check, reload, open the settings again and compare the textbox's
SHA-256 (from `crypto.subtle.digest` in the page) with the hash of `chatgpt-instructions.md`
with its final newline removed.

## Verified capabilities

Each line: capability, date, result. The first live run adds the rest.

- Installing the project instructions as above: 2026-11-27. The 5,374-character text saved;
  after a reload its SHA-256 matched the file's. The first try (fill and close, no keystroke)
  saved nothing.
- Updating the project instructions by a typed change: 2026-11-27. Put the caret after the
  unchanged text with `setSelectionRange`, typed only the added sentence with `computer`
  `type` (real keys, so Save appeared at once), saved. After a reload the textbox held 5,494
  characters and its SHA-256 matched the file's. For a small change this avoids replacing the
  whole text.

- Reading roles, message IDs and turn state with the snippet above: 2026-11-27, read-only run
  on a 4-message chat returned 4 messages, 4 distinct UUIDs, correct roles, all `complete`.
  The first version (reading `[data-conversation-role]` as the message) found no content and
  no IDs.

## Known limits

- How long a chat stays whole (measured 2026-11-27, one run, a temporary chat, the model the
  account picked, "Medium" in the composer). The first message held five planted facts; then
  40,308-character blocks of plain English words, each answered "ok"; a recall question every
  four blocks. Sizes count every character sent and received. At 643,050 ChatGPT listed all
  five and said they were in its context. At 803,806 it still listed them (they had been
  repeated in each recall answer) but said it "cannot directly verify them against the
  original message". At 1,687,844 it said it could not see the first message at all, only "a
  retained summary". So between about 640,000 and 800,000 characters, ChatGPT replaces the
  start of the chat with a summary, and only what was repeated later survives word for word.
  `CHAT_CHAR_LIMIT` is 480,000: three quarters of 643,050, so a rollover happens before the
  loss with a margin. Limits of the measurement: one run; filler words, not code or JSON,
  which hold more tokens per character, so a real chat may reach the edge sooner; text sent
  as attached files may be read by search rather than held in context (not tested).

- Unverified until the live run: that `file_upload` reaches ChatGPT's file input and that
  ChatGPT reads an attached `.md`; how intelligenceUI graphics render; whether a set title
  stays; the project instructions' upper length limit (5,374 characters saved, so the limit is
  higher; keep the text under 7,500 characters).

- Fenced blocks, seen 2026-11-27 on the first live run. ChatGPT no longer renders them as
  `pre`. The page uses `code[class*="CodeContent"]` (class `whitespace-pre! block
  text-size-code CodeContent-…`) inside plain divs, with the language label ("threeway") as
  text in a header div above it. The snippet selects `pre, code[class*="CodeContent"]`, drops
  nested duplicates, and reads the language from the nearest ancestor's text before the code.
  A snippet that queried only `pre` returned 0 blocks while a SESSION_HANDOFF and a
  CLAUDE_REQUEST were on the page. A user turn renders its block as `pre > code[data-language]` with no header label, so
  `data-language` is read first; without it the walk took the first word of the message text
  (`[claude]`). A `language-` class is the next fallback, but none was seen.

- `javascript_tool` cuts each returned string at about 1,000 characters, so a long turn does
  not come back whole. Get it out of the page with `navigator.clipboard.writeText(JSON.stringify(turns))`,
  then save it with `LC_ALL=en_US.UTF-8 pbpaste > turns.json`. Without the UTF-8 locale,
  `pbpaste` breaks non-ASCII characters.
