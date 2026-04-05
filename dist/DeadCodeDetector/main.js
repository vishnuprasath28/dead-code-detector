import {
  t
} from "./chunk-UESUDKJF.js";

// src/main/index.ts
var component = {
  async loaded(componentContext) {
    const studioPro = t(componentContext);
    await studioPro.ui.extensionsMenu.add({
      menuId: "DeadCodeDetector.MainMenu",
      caption: "Dead Code Detector",
      subMenus: [
        {
          menuId: "DeadCodeDetector.ShowMenu",
          caption: "Open Dead Code Detector",
          action: async () => {
            await studioPro.ui.tabs.open(
              {
                title: "Dead Code Detector"
              },
              {
                componentName: "extension/DeadCodeDetector",
                uiEntrypoint: "tab"
              }
            );
          }
        }
      ]
    });
  }
};
export {
  component
};
//# sourceMappingURL=main.js.map
