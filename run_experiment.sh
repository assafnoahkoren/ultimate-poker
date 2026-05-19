#!/usr/bin/env bash
# Run the UTH strategy comparison campaign.
#
# Usage:
#   ./run_experiment.sh                    # 1M hands per cell (default, ~1 hour)
#   ./run_experiment.sh 5000000            # 5M hands per cell  (~5 hours)
#   ./run_experiment.sh 100000             # 100K hands per cell (~6 min smoke test)
#
# Note: ev-optimal* strategies use live Monte Carlo at the flop and are ~4× slower
# than rule-based ones. Most of the wall time goes to those cells.
#
# Output:
#   results.csv  — one row per (strategy, table_size) cell

set -euo pipefail

cd "$(dirname "$0")"

HANDS="${1:-1000000}"

echo "Running UTH strategy campaign: $HANDS hands per cell"
echo "Output: results.csv"
echo
echo "Sweeping 6 strategies × 6 table sizes = 36 cells."
echo "  Baselines:    always-check, always-4x"
echo "  Rule-based:   optimal, optimal-table"
echo "  EV-driven:    ev-optimal, ev-optimal-table  (slower: live MC at flop)"
echo
echo "Progress is printed live; Ctrl-C is safe (partial rows already on disk)."
echo

go run ./cmd/strategysim \
    --hands "$HANDS" \
    --output results.csv \
    --seed 42 \
    --sizes "1,2,3,4,5,6" \
    --strats "always-check,always-4x,optimal,optimal-table,ev-optimal,ev-optimal-table"

echo
echo "Done. CSV at results.csv"
echo
echo "Quick summary:"
column -s, -t < results.csv | awk 'NR==1 || /strategy|always|optimal/ {print}' | head -30
