"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DutyCycleCalculatorToolUI,
  RenderArtifactToolUI,
  SetupConfiguratorToolUI,
  ShowManualVisualToolUI,
} from "@/components/assistant-ui/vulcan-tool-ui";
import { Preloader } from "@/components/preloader";
import { ProxMark, ProxWordmark } from "@/components/prox-logo";

export const Assistant = () => {
  const runtime = useChatRuntime({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Preloader />
      <ShowManualVisualToolUI />
      <RenderArtifactToolUI />
      <DutyCycleCalculatorToolUI />
      <SetupConfiguratorToolUI />
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500/15">
                  <ProxMark className="size-4.5 text-orange-500" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm leading-tight font-semibold">
                    Vulcan OmniPro 220
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      — Product Expert
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs leading-tight">
                      Powered by
                    </span>
                    <ProxWordmark height={10} />
                  </span>
                </div>
              </div>
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
