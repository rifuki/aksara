interface SolanaIconProps {
  className?: string;
}

export function SolanaIcon({ className }: SolanaIconProps) {
  return (
    <svg viewBox="0 0 128 128" fill="none" className={className}>
      <path
        d="M26.4 94.4a3 3 0 0 1 2.1-.9h87.4c1.3 0 2 1.6 1 2.6l-17 17a3 3 0 0 1-2.1.9H10.4c-1.3 0-2-1.6-1-2.6l17-17ZM26.4 14.9a3 3 0 0 1
  2.1-.9h87.4c1.3 0 2 1.6 1 2.6l-17 17a3 3 0 0 1-2.1.9H10.4c-1.3 0-2-1.6-1-2.6l17-17ZM101.6 54.4a3 3 0 0 0-2.1-.9H12.1c-1.3 0-2 1.6-1 2.6l17
  17a3 3 0 0 0 2.1.9h87.4c1.3 0 2-1.6 1-2.6l-17-17Z"
        fill="url(#solana-gradient)"
      />
      <defs>
        <linearGradient
          id="solana-gradient"
          x1="0"
          y1="0"
          x2="128"
          y2="128"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
    </svg>
  );
}
