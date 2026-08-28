import { formatCurrency } from "@/lib/formatting/money";

type PrintAmountProps = {
  value: string | number | null | undefined;
  blankZero?: boolean;
  className?: string;
};

export function PrintAmount({
  value,
  blankZero = false,
  className = "",
}: PrintAmountProps) {
  if (value === null || value === undefined || value === "") {
    return <span className={`print-amount ${className}`.trim()}>—</span>;
  }
  if (blankZero && Number(value) === 0) {
    return <span className={`print-amount ${className}`.trim()} />;
  }
  return (
    <span className={`print-amount ${className}`.trim()}>{formatCurrency(value)}</span>
  );
}
