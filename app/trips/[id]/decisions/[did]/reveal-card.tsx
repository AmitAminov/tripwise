import { DecideActions } from "./decide-actions";

type Rating = { option_id: string; user_id: string; score: number };
type Option = {
  id: string;
  label: string;
  url: string | null;
  notes: string | null;
  position: number;
};

/**
 * Reveal card — shown once the decision status flips to 'revealed'.
 * Displays every member's rating for this option, plus the combined
 * score. When both raters gave a 5, the card gets a highlight to
 * mark the pure-agreement moment (the intended emotional payoff).
 */
export function RevealCard({
  option,
  ratings,
  currentUserId,
  isWinner,
  canDecide,
  tripId,
  decisionId,
}: {
  option: Option;
  ratings: Rating[];
  currentUserId: string;
  isWinner: boolean;
  canDecide: boolean;
  tripId: string;
  decisionId: string;
}) {
  const myScore = ratings.find((r) => r.user_id === currentUserId)?.score;
  const others = ratings.filter((r) => r.user_id !== currentUserId);
  const total = ratings.reduce((sum, r) => sum + r.score, 0);
  const bothMax =
    ratings.length >= 2 && ratings.every((r) => r.score === 5);

  return (
    <div
      className={`card p-4 relative ${
        isWinner ? "ring-2 ring-[color:var(--color-accent)]" : ""
      } ${bothMax ? "bg-[color:var(--color-highlight)]/10" : ""}`}
    >
      {isWinner && (
        <div className="absolute -top-2 -right-2 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[color:var(--color-accent)] text-white font-medium">
          Winner
        </div>
      )}
      {bothMax && !isWinner && (
        <div className="absolute -top-2 -right-2 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-[color:var(--color-highlight)] text-black font-medium">
          Both 5★
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="font-medium">{option.label}</div>
          {option.url && (
            <a
              href={option.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-[color:var(--color-primary)] hover:underline truncate block"
            >
              {option.url}
            </a>
          )}
          {option.notes && (
            <p className="text-sm text-[color:var(--color-fg-2)] mt-1">
              {option.notes}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-serif text-2xl text-[color:var(--color-primary)] tabular-nums">
            {total}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
            Combined
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <ScoreRow
          label="You"
          score={myScore}
          accent
        />
        {others.map((r) => (
          <ScoreRow
            key={r.user_id}
            label="Partner"
            score={r.score}
          />
        ))}
        {others.length === 0 && (
          <ScoreRow label="Partner" score={undefined} />
        )}
      </div>

      {canDecide && (
        <div className="mt-4 pt-3 border-t border-[color:var(--color-line)]">
          <DecideActions
            mode="revealed"
            tripId={tripId}
            decisionId={decisionId}
            winningOptionId={option.id}
          />
        </div>
      )}
    </div>
  );
}

function ScoreRow({
  label,
  score,
  accent,
}: {
  label: string;
  score: number | undefined;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-md ${
        accent
          ? "bg-[color:var(--color-primary)]/8"
          : "bg-[color:var(--color-surface-2)]"
      }`}
    >
      <span className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {score == null ? (
          <span className="text-xs text-[color:var(--color-muted)] italic">
            no rating
          </span>
        ) : (
          <>
            {[1, 2, 3, 4, 5].map((n) => (
              <svg
                key={n}
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill={
                  n <= score ? "var(--color-highlight)" : "var(--color-line-2)"
                }
              >
                <path d="M12 2l3.09 6.26 6.91 1-5 4.87 1.18 6.87L12 17.77 5.82 21l1.18-6.87-5-4.87 6.91-1L12 2z" />
              </svg>
            ))}
            <span className="ml-1 text-sm tabular-nums font-medium">
              {score}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
