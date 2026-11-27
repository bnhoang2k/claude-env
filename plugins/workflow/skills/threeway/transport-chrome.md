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
  const langOf = (pre) => {  // UNVERIFIED: no fenced block seen on the page yet
    const code = pre.querySelector('code');
    const cls = [...(code?.classList || [])].find(c => c.startsWith('language-'));
    if (cls) return cls.slice('language-'.length);
    const label = pre.querySelector('div, span');  // header label above the code
    return (label?.textContent || '').trim().split(/\s/)[0].toLowerCase();
  };
  return [...document.querySelectorAll(ROLE)].map(h => {
    const u = unitOf(h);
    return {
      role: h.getAttribute('data-conversation-role'),
      message_id: attr(u, 'data-chatgpt-selection-message-id')
        || (attr(u, 'data-chatgpt-search-message-ids') || '').split(/\s+/)[0] || null,
      state: h.closest('[data-talvt-turn-state]')?.getAttribute('data-talvt-turn-state') || 'unknown',
      blocks: [...u.querySelectorAll('pre')].map(pre => ({
        lang: langOf(pre),
        text: (pre.querySelector('code') || pre).innerText,
        in_quote: !!pre.closest('blockquote'),
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

1. Find each `Figure VIS-nnn` caption in the transcript and the visual nearest to it.
2. Scroll the visual into view and save a region screenshot with `computer` `zoom`
   (`save_to_disk`). A visual taller than the window gets several shots, `VIS-nnn-1.png`, ….
3. Copy each into the session's `figures/` and record it with `threeway.py figure`, with the
   caption and the `Text equivalent:` line.
4. A visual that cannot be captured is recorded with `--failed "<why>"`, never skipped.

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

- Reading roles, message IDs and turn state with the snippet above: 2026-11-27, read-only run
  on a 4-message chat returned 4 messages, 4 distinct UUIDs, correct roles, all `complete`.
  The first version (reading `[data-conversation-role]` as the message) found no content and
  no IDs.

## Known limits

- Unverified until the live run: that `file_upload` reaches ChatGPT's file input and that
  ChatGPT reads an attached `.md`; how intelligenceUI graphics render; whether a set title
  stays; the project instructions' upper length limit (5,374 characters saved, so the limit is
  higher; keep the text under 7,500 characters); that ChatGPT code blocks render as `pre` and expose a `language-` class or a header label for
  `langOf` (the probed chat had only inline code, so no fenced block was seen).
