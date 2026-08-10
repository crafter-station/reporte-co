import { ReportForm } from "@/components/report-form";
import { storageEnabled } from "@/lib/storage";

export const metadata = { title: "Reportar · Reporte CO" };

export default function ReportarPage() {
  // Photo upload only appears when storage is configured (service-role key).
  return <ReportForm photosEnabled={storageEnabled()} />;
}
