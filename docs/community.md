# A community chat

Status: proposal, 2026-11-03. Nothing is built. The rooms, doors and phases below are a design to
accept, change or drop.

## Why

- The interface ships in six languages, and the people credited in the acknowledgments write in
  Japanese, Chinese, Korean and Vietnamese. Today they reach the maintainer through X, Telegram or
  the report dialog, one conversation at a time.
- A component name, a missing description, or a decomposition that looks wrong has no public place
  in the reader's language. The report dialog is private, and the issue tracker is in English.
- The tail of the character set — place names, personal names, dialect characters, Tangut and
  Shuishu — is where the audience is, and where one person's question is another's answer.

## Shape

One Matrix space, rooms by language and topic, several doors into the same rooms.

| Room | Language | For |
|---|---|---|
| Welcome | English | Announcements and arrivals |
| 中文 | Chinese | Chinese-language questions |
| 日本語 | Japanese | Japanese-language questions |
| 한국어 | Korean | Korean-language questions |
| Tiếng Việt | Vietnamese | Vietnamese-language questions |
| English | English | Questions in English |
| Curiosities | any | Characters with no code point, odd decompositions, finds |
| Questions | any | Usage and data questions that do not fit a language room |
| Feedback | any | Reports and requests, in public |
| Dev | any | The library, the workshop and the data pipeline |

Doors: Matrix (Element), Discord, Telegram, QQ, Libera.Chat IRC. A message sent through any door
appears in the room and in the other doors.

The bridges matter more than the homeserver. Many in the audience will arrive from Telegram or
Discord and never install a Matrix client; the room has to be where they already are. The cost is
that each bridge is another service to keep running and another set of relay accounts to moderate.

## The server

- A 1 vCPU, 1 GB VPS runs the homeserver, the bridges and Element. A machine of that size costs a
  few dollars a month; the time is the real cost.
- No port is open to the internet. Web traffic arrives through a Cloudflare Tunnel; SSH goes over
  Tailscale. The public IP answers nothing.
- Nightly encrypted backups of the homeserver and the bridge databases go to object storage, and a
  restore is tried before the chat is announced.
- Ubuntu's unattended upgrades handle security patches; the homeserver and bridges are upgraded by
  hand, after a backup, because their configuration changes between releases.

## Identity

ids-input has no accounts, and a chat should not be the reason to build them.

| Option | Work | Risk |
|---|---|---|
| Invite-only registration on the homeserver | A registration token, an admin room | The maintainer hands out every account |
| Open registration | None | Spam, impersonation, a moderation queue |
| GitHub sign-in | An OAuth client and a bridge | Ties chat to GitHub, which the audience may not use |
| Site accounts | Accounts, sessions, a database | Weeks to months of work for a chat |

Start with invite-only registration. It keeps the room small and the moderation load low; opening
registration later is one setting, closing it again is not.

## Start

1. One space with Welcome, 中文, 日本語 and Dev; bridges to Telegram and Discord; invitations to the
   people named in the acknowledgments.
2. Add a language room when its language has traffic, and QQ or IRC only when someone reads that
   door. Member counts on the site once there are counts worth showing.
3. Sign-in or open registration only if impersonation or spam appears.

## Open decisions

- Who moderates each language room? A room without a moderator in its language is a room the
  maintainer cannot follow.
- Room labels: simplified, traditional, or both. The interface ships both, and a room can carry only
  one name.
- Do corrections get recorded in the issue tracker while the room discusses them, or does the room
  keep its own record? The first keeps one source of truth.
- Is the maintenance worth it? A chat is a promise to answer.

## Scope

A room is for talk. A correction becomes data when it is written into the repository or the source
catalogue. Nothing said in a room is a source until then, and a chat log is not a citation. Reports
that carry personal data stay in the private intake; the Feedback room is for reports someone is
willing to make public.

## References

- Matrix, <https://matrix.org/> — the protocol and the homeserver ecosystem.
- Element, <https://element.io/> — the client the space would open in.
- Cloudflare Tunnel, <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
  — how the homeserver is reached without an open port.
- Tailscale, <https://tailscale.com/> — how the server is reached for administration.
