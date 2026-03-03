#!/usr/bin/env bash
# prefix a → cycle to next window with unseen activity (wrap-around)
# Falls back to next-window if nothing has activity.
set -euo pipefail

CUR_WIN=$(tmux display-message -p '#{window_index}')

# Find next window with activity_flag=1, starting after current (wrap-around)
ACTIVE_WIN=""
while IFS=$'\t' read -r idx flag; do
  if [ "$flag" = "1" ] && [ "$idx" != "$CUR_WIN" ]; then
    ACTIVE_WIN="$idx"
    break
  fi
done < <(
  tmux list-windows -F '#{window_index}'$'\t''#{window_activity_flag}' \
    | awk -F'\t' -v cur="$CUR_WIN" '
        { lines[NR] = $0; idxs[NR] = $1 }
        $1 == cur { start = NR }
        END {
          for (i = start+1; i <= NR; i++) print lines[i]
          for (i = 1; i <= start; i++) print lines[i]
        }'
)

if [ -n "$ACTIVE_WIN" ]; then
  tmux select-window -t ":$ACTIVE_WIN"
else
  tmux next-window
fi
