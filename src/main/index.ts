// src/main/index.ts

import { IComponent, getStudioProApi } from "@mendix/extensions-api";

export const component: IComponent = {
    async loaded(componentContext) {
        const studioPro = getStudioProApi(componentContext);
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
            ],
        });
    }
};
