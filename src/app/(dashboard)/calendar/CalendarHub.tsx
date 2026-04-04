"use client";

import React from "react";

import PostCreationPinnedBoard from "@/app/dashboard/boards/PostCreationPinnedBoard";

export default function CalendarHub() {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-transparent">
      <div className="mx-auto flex h-full min-h-0 w-full px-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
          <PostCreationPinnedBoard initialTab="planner" />
        </div>
      </div>
    </div>
  );
}
