// KanjiVG structure adapted from Ulrich Apel and contributors, CC BY-SA 3.0.
// Source https://kanjivg.tagaini.net/ — see ../NOTICE.md.
export const kanjiParts = {
  水: [],
  茶: [
    {
      glyph: "艹",
      position: "top",
      partial: false,
    },
    {
      glyph: "人",
      position: "",
      partial: false,
    },
    {
      glyph: "木",
      position: "",
      partial: false,
    },
  ],
  本: [
    {
      glyph: "木",
      position: "",
      partial: false,
    },
  ],
  円: [
    {
      glyph: "冂",
      position: "",
      partial: false,
    },
  ],
  入: [],
  出: [
    {
      glyph: "山",
      position: "",
      partial: false,
    },
    {
      glyph: "凵",
      position: "",
      partial: false,
    },
  ],
  右: [
    {
      glyph: "丆",
      position: "",
      partial: false,
    },
    {
      glyph: "口",
      position: "",
      partial: false,
    },
  ],
  左: [
    {
      glyph: "工",
      position: "",
      partial: false,
    },
  ],
  日: [],
  音: [
    {
      glyph: "立",
      position: "top",
      partial: false,
    },
    {
      glyph: "日",
      position: "bottom",
      partial: false,
    },
  ],
  楽: [
    {
      glyph: "白",
      position: "",
      partial: false,
    },
    {
      glyph: "冫",
      position: "",
      partial: false,
    },
    {
      glyph: "木",
      position: "bottom",
      partial: false,
    },
  ],
  店: [
    {
      glyph: "广",
      position: "tare",
      partial: false,
    },
    {
      glyph: "占",
      position: "tarec",
      partial: false,
    },
  ],
  新: [
    {
      glyph: "立",
      position: "",
      partial: false,
    },
    {
      glyph: "木",
      position: "",
      partial: false,
    },
    {
      glyph: "斤",
      position: "right",
      partial: false,
    },
  ],
  古: [
    {
      glyph: "十",
      position: "top",
      partial: false,
    },
    {
      glyph: "口",
      position: "bottom",
      partial: false,
    },
  ],
  行: [
    {
      glyph: "彳",
      position: "left",
      partial: false,
    },
  ],
  見: [
    {
      glyph: "目",
      position: "top",
      partial: false,
    },
    {
      glyph: "儿",
      position: "bottom",
      partial: false,
    },
  ],
  食: [],
  飲: [
    {
      glyph: "飠",
      position: "left",
      partial: true,
    },
    {
      glyph: "欠",
      position: "right",
      partial: false,
    },
  ],
  読: [
    {
      glyph: "言",
      position: "left",
      partial: false,
    },
    {
      glyph: "売",
      position: "right",
      partial: false,
    },
  ],
  書: [
    {
      glyph: "聿",
      position: "top",
      partial: false,
    },
    {
      glyph: "日",
      position: "bottom",
      partial: false,
    },
  ],
  話: [
    {
      glyph: "言",
      position: "left",
      partial: false,
    },
    {
      glyph: "舌",
      position: "right",
      partial: false,
    },
  ],
  聞: [
    {
      glyph: "門",
      position: "kamae",
      partial: false,
    },
    {
      glyph: "耳",
      position: "",
      partial: false,
    },
  ],
  買: [
    {
      glyph: "罒",
      position: "top",
      partial: false,
    },
    {
      glyph: "貝",
      position: "bottom",
      partial: false,
    },
  ],
  作: [
    {
      glyph: "亻",
      position: "left",
      partial: false,
    },
    {
      glyph: "乍",
      position: "right",
      partial: false,
    },
  ],
} as const;
export const kanjivgRevision = "70a0b7ae0c18ceb5cb358274b029cce0234a43bc";
