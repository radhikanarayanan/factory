"use strict";

const consoleLogWarningStyles = `
  color: #fff;
  background-color: #c23934;
  display: block;
  text-align: center;
  padding: 8px 32px;
  font: 100 16px/28px sans-serif;
  background-image: linear-gradient(45deg,rgba(0,0,0,.025) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.025) 50%,rgba(0,0,0,.025) 75%,transparent 75%,transparent);
  background-size: 64px 64px;
`;

/**
 * Uses https://github.com/Alorel/console-log-html to redirect console.* output to an HTML DOM element.
 * @param {*} ldsRedirectConsoleContainerID
 */
const lightningRedirectConsole = (
  ldsRedirectConsoleContainerID = "container_ldsRedirectConsole",
) => {
  const ldsRedirectConsoleContainer = document.getElementById(
    ldsRedirectConsoleContainerID,
  );
  if (ldsRedirectConsoleContainer) {
    $script(
      "//cdn.rawgit.com/Alorel/console-log-html/master/console-log-html.min.js",
      function () {
        ConsoleLogHTML.connect(ldsRedirectConsoleContainer);
        console.log(
          `Element ID '${ldsRedirectConsoleContainerID}' is logging console output. See github.com/Alorel/console-log-html for usage instructions.`,
        );
      },
    );
  } else {
    console.log(
      "%c%s",
      consoleLogWarningStyles,
      `Element with ID '${ldsRedirectConsoleContainerID}' required by lightningRedirectConsole() does not exist.`,
    );
  }
};

const assignlightningIconSvgUseBase = (svgUses, layout) => {
  const fixIconsRef = (use, refAttrName) => {
    const href = use.getAttribute(refAttrName);
    if (href) {
      const matches = href.match(
        /^\/assets\/icons\/(.*?)-sprite\/svg\/symbols.svg\#(.*?)$/i,
      );
      if (matches) {
        use.setAttribute(
          refAttrName,
          layout.lightingIconURL({
            collection: matches[1],
            name: matches[2],
          }),
        );
      }
    }
  };

  svgUses.forEach((use) => {
    fixIconsRef(use, "href");
    fixIconsRef(use, "xlink:href");
  });
};

const lightningToggleIsOpen = (element) =>
  element.classList.toggle("slds-is-open");
const lightningToggleParentIsOpen = (element) =>
  lightningToggleIsOpen(element.parentNode);

/**
 * [Dropdown Menus](https://www.lightningdesignsystem.com/components/menus/)
 */
const lightningDropdownButtons = document.querySelectorAll(
  ".slds-dropdown-trigger_click > .slds-button",
);

const lightningDropdownButtonsActivate = (
  buttons = Array.from(lightningDropdownButtons),
) => {
  buttons.forEach((button) =>
    button.addEventListener(
      "click",
      (event) => lightningToggleParentIsOpen(event.currentTarget),
      false,
    )
  );
};

/**
 * [Tabs](https://www.lightningdesignsystem.com/components/tabs/)
 */
const lightningTabs = (variant) =>
  document.querySelectorAll(
    `.slds-tabs_${variant} [role=tablist] [role=tab]`,
  );
const lightningTabActiveReset = (tab) =>
  Array.from(tab.parentNode.parentNode.querySelectorAll("li"))
    .forEach((element) => element.classList.remove("slds-active"));
const lightningTabActiveSet = (tab) =>
  tab.parentNode.classList.add("slds-active");
const lightningTabPanelsReset = (tab) =>
  Array.from(
    tab.parentNode.parentNode.parentNode.querySelectorAll('[role="tabpanel"]'),
  )
    .forEach((tabpanel) => {
      tabpanel.classList.remove("slds-show");
      tabpanel.classList.remove("slds-hide");
      tabpanel.classList.add("slds-hide");
    });
const lightningTabPanelShow = (tab) => {
  const tabpanel = document.getElementById(tab.getAttribute("aria-controls"));
  tabpanel.classList.remove("slds-show");
  tabpanel.classList.remove("slds-hide");
  tabpanel.classList.add("slds-show");
};

const defaultLightningTabs = lightningTabs("default");
const scopedLightningTabs = lightningTabs("scoped");

const assignLightningTabEvents = (event) => {
  lightningTabActiveReset(event.currentTarget);
  lightningTabActiveSet(event.currentTarget);
  lightningTabPanelsReset(event.currentTarget);
  lightningTabPanelShow(event.currentTarget);
};

const lightningTabsActivate = (
  tabs = [
    ...Array.from(defaultLightningTabs),
    ...Array.from(scopedLightningTabs),
  ],
) => {
  tabs.forEach((tab) => {
    console.dir(tab);
    tab.addEventListener("click", assignLightningTabEvents, false);
  });
};

/**
 * [TreeGrid](https://www.lightningdesignsystem.com/components/tree-grid/)
 */
const lightningTreeGridRowButtons = () =>
  document.querySelectorAll(
    `table.slds-table_tree > tbody > tr > th > button.slds-button`,
  );

const lightningTreeGridRowClick = (event) => {
  const findChildren = function (tr) {
    const children = [];
    const targetDepth = tr.getAttribute("aria-level");
    let sibling = tr.nextElementSibling;
    while (sibling) {
      const siblingDepth = sibling.getAttribute("aria-level");
      if (siblingDepth > targetDepth) {
        children.push(sibling);
        sibling = sibling.nextElementSibling;
      } else {
        break;
      }
    }
    return children;
  };

  const tr = event.target.closest("tr");
  let children = findChildren(tr);

  // remove already collapsed nodes so that we don't make them visible
  const subnodes = children.filter((c) =>
    c.getAttribute("aria-expanded") == "false"
  );
  subnodes.forEach((subnode) => {
    const subnodeChildren = findChildren(subnode);
    children = children.filter((el) => !subnodeChildren.includes(el));
  });

  if (tr.getAttribute("aria-expanded") == "true") {
    tr.setAttribute("aria-expanded", "false");
    children.forEach((c) => c.style.display = "none");
  } else {
    tr.setAttribute("aria-expanded", "true");
    children.forEach((c) => c.style.display = "");
  }
};

const lightningTreeGridsActivate = (
  buttons = Array.from(lightningTreeGridRowButtons()),
  click = true,
) => {
  buttons.forEach((btn) => {
    btn.addEventListener("click", lightningTreeGridRowClick, false);
    if (click) btn.click();
  });
};

const lightningActivateAllPageItems = {
  activateDropDownButtons: true,
  activateTabs: true,
  activateTreeGrids: true,
  activateIconSvgUse: true,
  activateDiagrams: true,
};

/**
 * lightningActivatePage is the "entry point" that is usually called in
 * <body onload=""> if Lightning Design System interactivity is desired.
 * When the page is activated, a cargo object that contains the "client
 * cargo" part of build process may be supplied. The client cargo is
 * useful for carrying build-time properties, such as page routes, to the
 * runtime client.
 * @param cargo object that contains the "client cargo" from server build
 * @returns HTML
 */
const lightningActivatePage = (
  cargo,
  options = lightningActivateAllPageItems,
) => {
  if (typeof cargo?.activate === "function") {
    cargo.activate(cargo);
  }

  if (options.activateDropDownButtons) lightningDropdownButtonsActivate();
  if (options.activateTabs) lightningTabsActivate();
  if (options.activateTreeGrids) lightningTreeGridsActivate();

  // Replace instances like <use href="..."> with proper location of assets:
  //   <svg class="slds-button__icon slds-button__icon_hint slds-button__icon_small" aria-hidden="true">
  //      <use href="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
  //   </svg>
  if (options.activateIconSvgUse) {
    assignlightningIconSvgUseBase(
      document.querySelectorAll("svg > use"),
      cargo,
    );
  }

  if (options.activateDiagrams) {
    KrokiContent.populateAll("pre.kroki-diagram[id]");
  }

  if (typeof cargo?.finalize === "function") {
    // TODO: pass anything else constructed that cargo might find help
    cargo.finalize(cargo);
  }
};
