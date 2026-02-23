"use client";
import React from "react";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useInvestment } from "@/hooks/use-investments";
import { EntryForm } from "@/components/forms/entry-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default function NewEntryPage({ params }: { params: Promise<{ investmentId: string }> }): React.JSX.Element {
  const { investmentId } = use(params);
  const { data: investment } = useInvestment(investmentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/investments/${investmentId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <PageHeader
          title="Add Monthly Entry"
          description={investment ? `For: ${investment.name}` : undefined}
        />
      </div>
      <EntryForm investmentId={investmentId} investment={investment} />
    </div>
  );
}
