import React from "react";
import { InvestmentForm } from "@/components/forms/investment-form";
import { PageHeader } from "@/components/shared/page-header";

export default function NewInvestmentPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Investment" description="Register a new investment instrument" />
      <InvestmentForm />
    </div>
  );
}
