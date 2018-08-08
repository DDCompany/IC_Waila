const Waila = {
    /**
     * Контейнер для окна
     */
    container: new UI.Container(),
    /**
     * Нужно ли показывать всплывающее окно. Имеет значение false, если текущий экран не hud_screen и не in_game_play_screen
     */
    enableToShow: false,
    /**
     * Объект, который хранит количество стадий роста у определённых растений. Ключом является айди блока.
     */
    growthStages: {},

    /**
     * Инициализация окна и установка количества стадий роста для ванильных растений
     */
    init: function () {
        this.setGrowthStages(59, 7);
        this.setGrowthStages(141, 7);
        this.setGrowthStages(142, 7);
        this.setGrowthStages(244, 7);

        this.popupWindow = new UI.Window({
            location: {
                x: WailaConfig.x,
                y: WailaConfig.y,
                width: 300,
                height: 90
            },

            drawing: [
                {type: "color", color: Color.rgb(18, 2, 17)}
            ],
            elements: {
                "slot": {
                    type: "slot",
                    x: 10,
                    y: 10,
                    size: 210,
                    bitmap: "_default_slot_empty",
                    isTransparentBackground: true,
                    visual: true
                },

                "name": {
                    type: "text",
                    text: "",
                    x: 200,
                    y: 30,
                    font: {color: Color.WHITE, size: 50}
                },

                "frame": {
                    type: "frame",
                    x: 0,
                    y: 0,
                    width: 1000,
                    height: 300,
                    bitmap: "waila_frame",
                    scale: 5,
                },
            }
        });

        this.popupWindow.setAsGameOverlay(true);
    },

    /**
     * Возвращает локализированную строку
     * @param key ключ
     * @param defaultValue стандартное значение, если локализация не задана
     * @returns {String} локализованная строка
     */
    translate: function (key, defaultValue) {
        let translated = Translation.translate(key);
        if (translated !== key)
            return translated;

        return defaultValue;
    },

    /**
     * Добавление информации о блоке в окно
     * @param id айди блока
     * @param data дата блока
     * @param elements объект с элементами окна
     * @returns {number} необходимая высота окна
     */
    buildBlockInfo: function (id, data, elements) {
        let y = 100;
        let height = 90;

        //Добаление кастомной информации из TileEntity
        let tile = World.getTileEntity(this.blockPos.x, this.blockPos.y, this.blockPos.z);
        if (tile) {
            if (tile.getDataForWaila) {
                let wailaData = tile.getDataForWaila();

                for (let i in wailaData) {
                    let data = wailaData[i];

                    if (!data.text)
                        continue;

                    elements["text" + i] = {
                        type: "text",
                        text: data.text,
                        x: 200,
                        y: y,
                        font: {color: data.color || Color.WHITE, size: 40}
                    };
                    y += 60;
                    height += 20;
                }
            }

            if (WailaConfig.tilesData) {
                for (let i in tile.data) {
                    elements["text" + i] = {
                        type: "text",
                        text: i + ": " + tile.data[i],
                        x: 200,
                        y: y,
                        font: {color: data.color || Color.WHITE, size: 40}
                    };
                    y += 60;
                    height += 20;
                }
            }

            //Добавление шкалы, отображающей количество энергии в механизме
            if (tile.data.energy) {
                this.addBar({
                    elements: elements,
                    progress: tile.data.energy,
                    progressMax: tile.getEnergyStorage ? tile.getEnergyStorage() : -1,
                    prefix: "energy",
                    yPos: y
                });

                y += 80;
                height += 30;
            }

        }

        let blockData = ToolAPI.getBlockData(id);
        let growthStages = this.getGrowthStages(id);

        //Добавление прогресса роста растения
        if (growthStages > -1) {
            elements["growthValue"] = {
                type: "text",
                text: Waila.translate("waila.growth", "Growth") + ": " + Math.floor(data / growthStages * 100) + "%",
                x: 200,
                y: y,
                font: {color: Color.WHITE, size: 40}
            };
            y += 60;
            if (blockData)
                height += 20;
        }

        //Добавление информации о материале, уровне ломания, возможности сломать данный блок
        if (blockData) {
            elements["materialName"] = {
                type: "text",
                text: Waila.translate("waila.material", "Material") + ": " + blockData.material.name,
                x: 200,
                y: y,
                font: {color: Color.WHITE, size: 40}
            };
            y += 60;
            elements["materialLevel"] = {
                type: "text",
                text: Waila.translate("waila.level", "Level") + ": " + blockData.level,
                x: 200,
                y: y,
                font: {color: Color.WHITE, size: 40}
            };
            y += 60;
            let validTool = Waila.isValidTool(blockData.material.name, blockData.level);
            elements["isHarvestable"] = {
                type: "text",
                text: (validTool ? "✔" : "✖") + " " + Waila.translate("waila.harvestable", "Currently Harvestable"),
                x: 200,
                y: y,
                font: {
                    color: validTool ? Color.GREEN : Color.RED,
                    size: 40,
                }
            };
        }

        return height;
    },

    /**
     * Добавляем информацию о сущности в окно
     * @param entity сущность
     * @param type айди типа сущности
     * @param elements объект с элементами окна
     * @returns {number} необходимая высота окна
     */
    buildEntityInfo: function (entity, type, elements) {
        elements["entityType"] = {
            type: "text",
            text: Waila.translate("waila.entity_type", "Entity Type") + ": " + type,
            x: 200,
            y: 100,
            font: {color: Color.WHITE, size: 40}
        };

        this.addBar({
            elements: elements,
            progress: Entity.getHealth(entity),
            progressMax: Entity.getMaxHealth(entity),
            prefix: "health"
        });

        return 90;
    },

    /**
     * Показ всплывающего окна
     * @param block блок. Объект, который содержит поля id и data
     * @param entity сущность
     * @param type тип сущности
     */
    showPopup: function (block, entity, type) {
        let elements = this.popupWindow.getContent().elements;

        for (let i in elements) {
            if (i !== "slot" && i !== "name" && i !== "frame")
                elements[i] = null;
        }

        let height;
        let slot = this.container.getSlot("slot");
        slot.count = 1;

        if (block) {
            slot.id = block.id;
            slot.data = block.data;

            let name = Item.getName(block.id, block.data);
            elements["name"].text = name.length <= 18 ? name : name.substr(0, 18) + "...";

            height = this.buildBlockInfo(block.id, block.data, elements);
        } else {
            slot.id = 383;
            slot.data = type;

            elements["name"].text = this.translate("waila.entity", "Entity");

            height = this.buildEntityInfo(entity, type, elements);
        }

        if (this.lastHeight !== height || !this.container.isOpened()) {
            this.popupWindow.getLocation().setSize(300, height);
            this.lastHeight = height;
            elements["frame"].height = this.popupWindow.getLocation().globalToWindow(height);

            UI.getContext().runOnUiThread(new java.lang.Runnable({
                run: function () {
                    Waila.container.openAs(Waila.popupWindow);
                }
            }));
        }
    },

    /**
     * Добавление шкалы в всплывающее окно
     * @param obj объект, который может хранить следующие поля:
     * elements(обязательное поле)  - список элементов, куда необходимо добавить шкалу,
     * prefix(обязательное поле)    - префикс для элементов, имеет значение, если используются несколько шкал,
     * progress                     - текущее значение прогресса,
     * progressMax                  - максимальное значение прогресса,
     * yPos                         - позиция шкалы по оси Y,
     * barBgTexture                 - текстура заполненной шкалы,
     * fontColor                    - цвет текста
     */
    addBar: function (obj) {
        let elements = obj.elements;
        let prefix = obj.prefix;

        if (!elements || !prefix) {
            Logger.Log("Elements or prefix property for Waila bar is not set", "ERROR");
            return;
        }


        obj.progress = obj.progress || 0;
        obj.barTexture = obj.barTexture || "waila_bar";
        obj.barBgTexture = obj.barBgTexture || "waila_bar_bg";
        let yPos = obj.yPos || 160;

        elements[prefix + "BarBg"] = {
            type: "image",
            bitmap: obj.barBgTexture,
            x: 200,
            y: yPos,
            scale: 3
        };
        elements[prefix + "Bar"] = {
            type: "scale",
            x: 200,
            y: yPos,
            value: obj.progressMax < 0 ? 1 : obj.progress / obj.progressMax,
            bitmap: obj.barTexture,
            scale: 3
        };
        elements[prefix] = {
            type: "text",
            text: obj.progress + "/" + obj.progressMax,
            x: 215,
            y: yPos + 8,
            font: {color: obj.fontColor || Color.WHITE, size: 40}
        };
    },

    /**
     * Можно ли сломать блок инструментом в руке
     * @param material название материала блока
     * @param blockLevel уровень ломания блока
     * @returns {Boolean} можн ли сломать блок
     */
    isValidTool: function (material, blockLevel) {
        if (material === "unbreaking")
            return false;

        if (!blockLevel)
            return true;

        let toolData = ToolAPI.getToolData(this.lastTool);
        return toolData && toolData.blockMaterials && toolData.blockMaterials[material] && toolData.toolMaterial.level >= blockLevel;
    },

    /**
     * Возвращает количество стадий роста у растения
     * @param id айди блока
     * @returns {Number} количество стадий. -1, если блок не является растением.
     */
    getGrowthStages: function (id) {
        let stages = this.growthStages[id];
        if (stages)
            return stages;

        if (CropRegistry.isCrop(id))
            return 2;

        return -1;
    },

    /**
     * Установка количества стадий роста для растения
     * @param blockId айди блока
     * @param stages количество стадий
     */
    setGrowthStages: function (blockId, stages) {
        this.growthStages[blockId] = stages;
    }
};

Waila.init();

Callback.addCallback("tick", function () {
    if (World.getThreadTime() % WailaConfig.checkTime === 0) {
        if (Waila.enableToShow) {
            let pointed = getPointed();
            let pos = pointed.pos;
            let lastPos = Waila.blockPos;
            let entity = Waila.pointedEntity;
            Waila.lastTool = Player.getCarriedItem().id;

            if (lastPos && lastPos.x === pos.x && lastPos.y === pos.y && lastPos.z === pos.z)
                return;

            if (entity !== -1 && pointed.entity === entity)
                return;

            Waila.blockPos = pos;
            entity = Waila.pointedEntity = pointed.entity;

            if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) {
                Waila.showPopup(World.getBlock(pos.x, pos.y, pos.z));
                return;
            }

            let type = Entity.getType(entity);
            if (entity !== -1 && type !== 71) {
                Waila.showPopup(null, entity, type);
                return;
            }

        }

        Waila.container.close();
    }
});

Callback.addCallback("NativeGuiChanged", function (screenName) {
    if (!(Waila.enableToShow = screenName === "hud_screen" || screenName === "in_game_play_screen")) {
        Waila.container.close();
    }
});

