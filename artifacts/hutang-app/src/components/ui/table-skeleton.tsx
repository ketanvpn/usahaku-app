import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  rows?: number;
  cols: number;
}

export function TableSkeleton({ rows = 5, cols }: TableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className={`h-4 ${j === 0 ? "w-24" : j === cols - 1 ? "w-16 ml-auto" : "w-32"}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
