import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { SidebarLayoutContext } from "./SidebarLayoutContext";

export default function PortalLayout() {
  return (
    <SidebarLayoutContext.Provider value={true}>
      <Sidebar isRootLayout={true} />
      <Outlet />
    </SidebarLayoutContext.Provider>
  );
}

