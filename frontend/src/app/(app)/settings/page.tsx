"use client";
import React from "react";

import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage(): React.JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account" />

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{user?.full_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN") : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => logout()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
