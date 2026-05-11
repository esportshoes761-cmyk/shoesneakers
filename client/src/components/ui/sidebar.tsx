import * as React from "react"
import { cn } from "@/lib/utils"

const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="flex">{children}</div>
}

const Sidebar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return <aside className={cn("w-64 bg-sidebar border-r", className)}>{children}</aside>
}

const SidebarHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return <div className={cn("p-4 border-b", className)}>{children}</div>
}

const SidebarContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return <div className={cn("flex-1 p-4", className)}>{children}</div>
}

const SidebarMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ul className="space-y-2">{children}</ul>
}

const SidebarMenuItem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <li>{children}</li>
}

const SidebarMenuButton: React.FC<{
  children: React.ReactNode;
  asChild?: boolean;
  isActive?: boolean;
}> = ({ children, asChild, isActive }) => {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent",
      isActive && "bg-sidebar-accent"
    )}>
      {children}
    </div>
  )
}

const SidebarTrigger: React.FC<{ className?: string }> = ({ className }) => {
  return <button className={cn("p-2", className)}>☰</button>
}

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger
}