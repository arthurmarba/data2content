"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import UserComparativeKpiSection from "../kpis/UserComparativeKpiSection";
import UserPerformanceHighlights from "../UserPerformanceHighlights";
import UserVideoPerformanceMetrics from "../UserVideoPerformanceMetrics";
import UserAlertsWidget from "../widgets/UserAlertsWidget";
import UserDemographicsWidget from "../UserDemographicsWidget";
import AdminPlanningCharts from "../AdminPlanningCharts";

interface UserDetailViewProps {
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  onBack: () => void;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({
  userId,
  userName,
  userPhotoUrl,
  onBack,
}) => {
  const [kpiComparisonPeriod, setKpiComparisonPeriod] = useState<
    "last_7_days" | "last_30_days" | "last_90_days"
  >("last_30_days");

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
            aria-label="Voltar"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {userPhotoUrl ? (
              <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-200 shadow-sm">
                <Image
                  src={userPhotoUrl}
                  alt={userName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {userName}
              </h2>
              <p className="text-xs text-slate-500">Visão detalhada do criador</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Section */}
      <section>
        <UserComparativeKpiSection userId={userId} />
      </section>

      {/* Highlights Section */}
      <section>
        <UserPerformanceHighlights userId={userId} />
      </section>

      {/* Main Charts Section (Replaces old Trends) */}
      <section>
        <AdminPlanningCharts userId={userId} />
      </section>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Performance */}
        <div className="space-y-6">
          <UserVideoPerformanceMetrics userId={userId} />
        </div>

        {/* Widgets Column */}
        <div className="space-y-6">
          <UserAlertsWidget userId={userId} />
          <UserDemographicsWidget userId={userId} />
        </div>
      </div>
    </div>
  );
};

export default UserDetailView;
