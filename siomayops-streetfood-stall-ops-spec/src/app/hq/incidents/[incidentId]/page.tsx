import IncidentReviewClient from "./incident-review-client";

export default async function IncidentReviewPage({ params }: { params: Promise<{ incidentId: string }> }) {
  const { incidentId } = await params;
  return <IncidentReviewClient incidentId={incidentId} />;
}
