import type * as React from "react";
import { ProxMark, ProxWordmark } from "@/components/prox-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="aui-sidebar-header mb-2 border-b">
        <div className="aui-sidebar-header-content flex items-center justify-between">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<a href="/" />}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-orange-500/15">
                  <ProxMark className="size-4 text-orange-500" />
                </div>
                <div className="aui-sidebar-header-heading me-6 flex flex-col gap-0.5 leading-none">
                  <span className="aui-sidebar-header-title font-semibold">
                    Vulcan Expert
                  </span>
                  <span className="text-muted-foreground text-xs">
                    OmniPro 220
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarHeader>
      <SidebarContent className="aui-sidebar-content px-2">
        <ThreadList />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="aui-sidebar-footer border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-muted-foreground text-xs">
                Powered by
              </span>
              <ProxWordmark height={12} />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
