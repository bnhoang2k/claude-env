You are a stranger reading this repo. Allowed: code, tests, and what a user or their AI assistant needs to use this kit.

List every line that tells you anything about who made it, how they work, what they decided and why, their tools, their other projects or their private files. Give the file, the line and why.

How to work:
- Use Glob to list every text file in the folder. Then use Read on each file, one by one. Do not skip a file.
- Comments and docs count. A single sentence inside a comment counts.
- Report each line on its own. Give its exact line number. Do not write a summary and do not group lines.
- Count lines from 1 at the top of each file, as Read shows them.
- An empty list is a valid answer. Do not invent a finding.
- Return the answer as JSON with one list named findings. Each item has file, line and why. File is the path relative to the folder.
