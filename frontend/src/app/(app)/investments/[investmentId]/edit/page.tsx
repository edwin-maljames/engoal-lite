"use client";
import React from "react";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useInvestment } from "@/hooks/use-investments";
import { InvestmentForm } from "@/components/forms/investment-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function EditInvestmentPage({ params }: { params: Promise<{ investmentId: string }> }): React.JSX.Element {
  const { investmentId } = use(params);
  const { data: investment, isLoading } = useInvestment(investmentId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/investments/${investmentId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader title="Edit Investment" />
      </div>
      {investment && <InvestmentForm investment={investment} investmentId={investmentId} />}
    </div>
  );
}
