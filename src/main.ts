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
      .setName("常规")
      .setHeading();

    new Setting(containerEl)
      .setName("自动保存")
      .setDesc("编辑思维导图时自动保存更改，无需手动点击保存按钮")
      .addToggle((toggle: ToggleComponent) => {
        toggle
          .setValue(this.plugin.settings.autoSave)
          .onChange(async (value: boolean) => {
            this.plugin.settings.autoSave = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("自动保存间隔")
      .setDesc("自动保存的时间间隔（秒）")
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
        .setTooltip("恢复默认值 (30秒)")
        .onClick(async () => {
          this.plugin.settings.autoSaveInterval = DEFAULT_SETTINGS.autoSaveInterval;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("外观与默认")
      .setHeading();

    // 默认布局
    new Setting(containerEl)
      .setName("默认布局")
      .setDesc("新建思维导图时使用的默认布局")
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
      .setName("紧凑模式")
      .setDesc("新建导图默认使用紧凑布局（间距更小，可显示更多内容）。已有文件以自身设置为准。")
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
      .setName("主题配色")
      .setDesc("新建导图时的默认分支配色。已有文件以自身设置为准。")
      .addDropdown((dd) => {
        dd.addOption("classic", "经典（白底不染色）");
        dd.addOption("rainbow", "彩虹分支（一级七彩）");
        dd.addOption("pastel", "柔和色板（一级柔和色）");
        dd.setValue(this.plugin.settings.theme);
        dd.onChange(async (value: string) => {
          this.plugin.settings.theme = value as ThemeKey;
          await this.plugin.saveSettings();
        });
      });

    // 缩略图开关
    new Setting(containerEl)
      .setName("显示缩略图")
      .setDesc("打开导图时是否显示右下角缩略图（mini map）。工具栏「缩略图」按钮可临时切换。")
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
      .setName("默认缩放")
      .setDesc("打开导图时的初始缩放：适应视图（自动缩放至全屏可见）或 100%（原始大小，可手动拖拽/滚轮缩放）。")
      .addDropdown((dd) => {
        dd.addOption("fit", "适应视图（自动缩放）");
        dd.addOption("100", "100%（原始大小）");
        dd.setValue(this.plugin.settings.defaultZoom);
        dd.onChange(async (value: string) => {
          this.plugin.settings.defaultZoom = value as "fit" | "100";
          await this.plugin.saveSettings();
        });
      });

    containerEl.createDiv({ cls: "setting-item-description" }, (div) => {
      const p = div.createEl("p");
      p.setCssStyles({ marginTop: "12px", color: "var(--text-muted)", fontSize: "13px" });
      p.append("当前间隔：");
      const strong = p.createEl("strong");
      strong.textContent = `${this.plugin.settings.autoSaveInterval} 秒`;
      p.createEl("br");
      p.append("快捷键：Ctrl+S 手动保存 · Tab 添加子主题 · Enter 添加同级 · Delete 删除节点");
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
      .setName("新建思维导图")
      .setHeading();
    const input = contentEl.createEl("input", {
      type: "text",
      value: this.value,
      placeholder: "文件名（无需扩展名）",
    });
    input.addClass("mm-filename-input");
    input.focus();
    input.select();

    const hint = contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "将创建 .xmind 文件，可在 Obsidian 中双击打开编辑。",
    });
    hint.setCssStyles({ margin: "8px 0" })

    const row = contentEl.createDiv({ cls: "modal-button-row" });
    const ok = row.createEl("button", { text: "创建", cls: "mod-cta" });
    const cancel = row.createEl("button", { text: "取消" });
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

    // 注册自定义「思维导图」图标（供右键菜单使用）
    // 旧版 Obsidian 可能没有 addIcon，做存在性检测 + 降级，避免 onload 抛错导致插件加载失败
    try {
      const maybeAddIcon = (this as unknown as { addIcon?: (id: string, svg: string) => void }).addIcon;
      if (typeof maybeAddIcon === "function") {
        maybeAddIcon.call(
          this,
          "mindmap",
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8.2 11L16 6.6M8.2 13L16 17.4"/></svg>`
        );
      }
    } catch (e) {
      console.warn("[MindMap] 注册自定义图标失败，已降级：", e);
    }

    this.registerView(VIEW_TYPE_MINDMAP, (leaf) => new MindMapView(leaf));
    this.registerExtensions(["xmind"], VIEW_TYPE_MINDMAP);

    // 注册设置面板（这是插件在 Obsidian 设置中正确显示的关键）
    this.addSettingTab(new MindMapSettingTab(this.app, this));

    // 新建思维导图（命令面板 / 快捷键）
    this.addCommand({
      id: "new-mindmap",
      name: "新建思维导图 (.xmind)",
      callback: () => this.newMindMap(),
    });

    // 文件列表右键菜单：在所选文件夹（或文件所在目录）新建思维导图
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!file) return;
        const targetFolder = file instanceof TFolder ? file : file.parent;
        menu.addItem((item) =>
          item
            .setTitle("新建思维导图")
            .setIcon("mindmap")
            .onClick(() => this.newMindMap(targetFolder))
        );
      })
    );

    // 保存当前思维导图（Ctrl+S 也会触发视图的 save()）
    this.addCommand({
      id: "save-mindmap",
      name: "保存当前思维导图",
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
    let defaultName = "思维导图";
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
        new Notice("新建思维导图失败：" + (e as Error).message);
        console.error(e);
      }
    }).open();
  }

  private async createMindMapFile(rawName: string, targetFolder?: TFolder | null) {
    let fname = (rawName || "思维导图").trim();
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
      new Notice("文件已存在：" + path);
      return;
    }

    const rootTopic: XTopic = {
      id: genId("topic"),
      class: "topic",
      title: "中心主题",
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
    new Notice("已创建 " + path);
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
