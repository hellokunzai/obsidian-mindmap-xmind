import {
  Plugin,
  TFile,
  TFolder,
  Notice,
  Modal,
  App,
  PluginSettingTab,
  Setting,
  ToggleComponent,
  SliderComponent,
  ExtraButtonComponent,
  addIcon,
} from "obsidian";
import {
  MindMapView,
  VIEW_TYPE_MINDMAP,
  setPluginInstance,
  LAYOUTS,
  LAYOUT_ORDER,
  applyDefaultThemeToRoot,
} from "./MindMapView";
import type { LayoutKey, ThemeKey } from "./MindMapView";
import { serializeXMind } from "./xmind";
import { genId } from "./util";
import type { XSheet, XTopic } from "./model";
import { registerToolbarIcons } from "./icons";
import { t } from "./i18n";

// 插件设置接口
export interface MindMapPluginSettings {
  autoSave: boolean;          // 是否启用自动保存
  autoSaveInterval: number;   // 自动保存间隔（秒）
  defaultLayout: LayoutKey;   // 新建导图时的默认布局
  compactMode: boolean;       // 新建导图是否默认紧凑布局
  theme: ThemeKey;            // 新建导图时的默认分支配色
  showMinimap: boolean;       // 打开导图时是否显示缩略图
  defaultZoom: "fit" | "100"; // 默认缩放：fit=适应视图，100=100% 原始大小
}

// 默认设置
const DEFAULT_SETTINGS: MindMapPluginSettings = {
  autoSave: false,
  autoSaveInterval: 30,
  defaultLayout: "balance",
  compactMode: false,
  theme: "classic",
  showMinimap: false,
  defaultZoom: "fit",
};

// 插件设置面板（让插件在 Obsidian 设置中正确显示）
class MindMapSettingTab extends PluginSettingTab {
  plugin: MindMapPlugin;

  constructor(app: App, plugin: MindMapPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("settings.general"))
      .setHeading();

    new Setting(containerEl)
      .setName(t("settings.autoSave.name"))
      .setDesc(t("settings.autoSave.desc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.autoSave)
          .onChange(async (value: boolean) => {
            this.plugin.settings.autoSave = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("settings.autoSaveInterval.name"))
      .setDesc(t("settings.autoSaveInterval.desc"))
      .addSlider((slider: SliderComponent) => slider
        .setLimits(10, 300, 10)
        .setValue(this.plugin.settings.autoSaveInterval)
        .setDynamicTooltip()
        .onChange(async (value: number) => {
          this.plugin.settings.autoSaveInterval = value;
          await this.plugin.saveSettings();
        })
      )
      .addExtraButton((btn: ExtraButtonComponent) => btn
        .setIcon("reset")
        .setTooltip(t("settings.resetInterval", { seconds: String(DEFAULT_SETTINGS.autoSaveInterval) }))
        .onClick(async () => {
          this.plugin.settings.autoSaveInterval = DEFAULT_SETTINGS.autoSaveInterval;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName(t("settings.appearance"))
      .setHeading();

    // 默认布局
    new Setting(containerEl)
      .setName(t("settings.defaultLayout.name"))
      .setDesc(t("settings.defaultLayout.desc"))
      .addDropdown((dd) => {
        for (const key of LAYOUT_ORDER) {
          dd.addOption(key, LAYOUTS[key].label);
        }
        dd.setValue(this.plugin.settings.defaultLayout);
        dd.onChange(async (value: string) => {
          this.plugin.settings.defaultLayout = value as LayoutKey;
          await this.plugin.saveSettings();
        });
      });

    // 紧凑模式
    new Setting(containerEl)
      .setName(t("settings.compactMode.name"))
      .setDesc(t("settings.compactMode.desc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.compactMode)
          .onChange(async (value: boolean) => {
            this.plugin.settings.compactMode = value;
            await this.plugin.saveSettings();
          });
      });

    // 主题配色
    new Setting(containerEl)
      .setName(t("settings.theme.name"))
      .setDesc(t("settings.theme.desc"))
      .addDropdown((dd) => {
        dd.addOption("classic", t("settings.theme.classic"));
        dd.addOption("rainbow", t("settings.theme.rainbow"));
        dd.addOption("pastel", t("settings.theme.pastel"));
        dd.setValue(this.plugin.settings.theme);
        dd.onChange(async (value: string) => {
          this.plugin.settings.theme = value as ThemeKey;
          await this.plugin.saveSettings();
        });
      });

    // 缩略图开关
    new Setting(containerEl)
      .setName(t("settings.showMinimap.name"))
      .setDesc(t("settings.showMinimap.desc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.showMinimap)
          .onChange(async (value: boolean) => {
            this.plugin.settings.showMinimap = value;
            await this.plugin.saveSettings();
          });
      });

    // 默认缩放
    new Setting(containerEl)
      .setName(t("settings.defaultZoom.name"))
      .setDesc(t("settings.defaultZoom.desc"))
      .addDropdown((dd) => {
        dd.addOption("fit", t("settings.defaultZoom.fit"));
        dd.addOption("100", t("settings.defaultZoom.oneHundred"));
        dd.setValue(this.plugin.settings.defaultZoom);
        dd.onChange(async (value: string) => {
          this.plugin.settings.defaultZoom = value as "fit" | "100";
          await this.plugin.saveSettings();
        });
      });

    containerEl.createDiv({ cls: "setting-item-description" }, (div) => {
      const p = div.createEl("p");
      p.setCssStyles({ marginTop: "12px", color: "var(--text-muted)", fontSize: "13px" });
      p.append(t("settings.currentInterval"));
      const strong = p.createEl("strong");
      strong.textContent = t("settings.intervalSeconds", { count: String(this.plugin.settings.autoSaveInterval) });
      p.createEl("br");
      p.append(t("settings.shortcuts"));
    });
  }
}

// 用 Obsidian 原生 Modal 要文件名，避免 window.prompt 在 Obsidian 中不弹窗的问题
class FileNameModal extends Modal {
  private value: string;
  private onSubmit: (name: string) => void;

  constructor(app: App, defaultName: string, onSubmit: (name: string) => void) {
    super(app);
    this.value = defaultName;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl)
      .setName(t("modal.newMindmap.title"))
      .setHeading();
    const input = contentEl.createEl("input", {
      type: "text",
      value: this.value,
      placeholder: t("modal.newMindmap.placeholder"),
    });
    input.addClass("mm-filename-input");
    input.focus();
    input.select();

    const hint = contentEl.createEl("p", {
      cls: "setting-item-description",
      text: t("modal.newMindmap.hint"),
    });
    hint.setCssStyles({ margin: "8px 0" })

    const row = contentEl.createDiv({ cls: "modal-button-row" });
    const ok = row.createEl("button", { text: t("modal.create"), cls: "mod-cta" });
    const cancel = row.createEl("button", { text: t("modal.cancel") });
    // mod-cta 在无主题变量时可能没底色，补一个显式样式
    ok.setCssStyles({ marginRight: "8px" })

    const submit = () => {
      const v = input.value.trim();
      this.close();
      this.onSubmit(v);
    };
    const closeNoop = () => this.close();

    ok.addEventListener("click", submit);
    cancel.addEventListener("click", closeNoop);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeNoop();
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export default class MindMapPlugin extends Plugin {
  settings: MindMapPluginSettings = DEFAULT_SETTINGS;

  async onload() {
    // 加载设置
    await this.loadSettings();

    // 设置插件实例引用（让 MindMapView 能访问插件进行自动保存注册）
    setPluginInstance(this);

    // 注册工具栏自定义图标
    registerToolbarIcons();

    // 注册自定义「思维导图」图标（供右键菜单使用）
    // Obsidian addIcon 要求：不带 <svg> 外层标签，内容需 fit 在 0 0 100 100 viewBox。
    addIcon(
      "mindmap",
      `<g transform="scale(4.1666667)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8.2 11L16 6.6M8.2 13L16 17.4"/></g>`
    );

    this.registerView(VIEW_TYPE_MINDMAP, (leaf) => new MindMapView(leaf));
    this.registerExtensions(["xmind"], VIEW_TYPE_MINDMAP);

    // 注册设置面板（这是插件在 Obsidian 设置中正确显示的关键）
    this.addSettingTab(new MindMapSettingTab(this.app, this));

    // 新建思维导图（命令面板 / 快捷键）
    this.addCommand({
      id: "new-mindmap",
      name: t("command.newMindmap"),
      callback: () => this.newMindMap(),
    });

    // 文件列表右键菜单：在所选文件夹（或文件所在目录）新建思维导图
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!file) return;
        const targetFolder = file instanceof TFolder ? file : file.parent;
        menu.addItem((item) =>
          item
            .setTitle(t("menu.newMindmap"))
            .setIcon("mindmap")
            .onClick(() => this.newMindMap(targetFolder))
        );
      })
    );

    // 保存当前思维导图（Ctrl+S 也会触发视图的 save()）
    this.addCommand({
      id: "save-mindmap",
      name: t("command.saveMindmap"),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MindMapView);
        if (view) {
          if (!checking) view.save();
          return true;
        }
        return false;
      },
    });
  }

  async newMindMap(targetFolder?: TFolder | null) {
    let defaultName = t("default.mindMapName");
    if (targetFolder) {
      defaultName = targetFolder.name;
    } else {
      const af = this.app.workspace.getActiveFile();
      if (af && af.basename) defaultName = af.basename;
    }

    new FileNameModal(this.app, defaultName, async (name) => {
      try {
        await this.createMindMapFile(name, targetFolder);
      } catch (e) {
        new Notice(t("notice.createFail", { msg: (e as Error).message }));
        console.error(e);
      }
    }).open();
  }

  private async createMindMapFile(rawName: string, targetFolder?: TFolder | null) {
    let fname = (rawName || t("default.mindMapName")).trim();
    if (!fname.toLowerCase().endsWith(".xmind")) fname += ".xmind";

    let folder = "";
    if (targetFolder) {
      folder = targetFolder.path;
    } else {
      const af = this.app.workspace.getActiveFile();
      folder = af && af.parent ? af.parent.path : "";
    }
    const path = folder ? `${folder}/${fname}` : fname;

    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(t("notice.fileExists", { path }));
      return;
    }

    const rootTopic: XTopic = {
      id: genId("topic"),
      class: "topic",
      title: t("default.centerTopic"),
      children: { attached: [] },
    };
    // 套用插件默认主题与紧凑设置（仅影响新建文件，已有文件以自身存储为准）
    applyDefaultThemeToRoot(rootTopic, this.settings.theme, this.settings.compactMode);

    const sheets: XSheet[] = [
      {
        id: genId("sheet"),
        class: "sheet",
        title: "Sheet 1",
        rootTopic,
      },
    ];
    const data = await serializeXMind(sheets);
    const file = await this.app.vault.createBinary(path, data);
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice(t("notice.created", { path }));
  }

  // ---------- 设置管理 ----------

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  override onunload() {
    // 插件卸载时无需额外清理，自动保存由视图自身管理
  }
}
