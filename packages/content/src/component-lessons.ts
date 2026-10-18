// Original Kiro JP recognition notes and memory aids. Shape/position links are
// separately sourced from KanjiVG; these stories do not assert etymologies.
export const componentLessons: Readonly<
  Record<string, { name: string; note: string; forms?: string }>
> = {
  亻: {
    name: "Person",
    note: "A narrow person shape with two strokes. Look for it on the left, as in 作.",
    forms: "人 · 亻",
  },
  人: {
    name: "Person",
    note: "Two strokes spread like a person standing. It can become the narrow 亻 on the left of another shape.",
    forms: "人 · 亻",
  },
  入: {
    name: "Enter",
    note: "Notice the two meeting strokes. Compare it carefully with 人; their crossing and stroke direction differ.",
  },
  冂: {
    name: "Enclosure",
    note: "A frame open at the bottom. In 円, find the outside frame before noticing the inner strokes.",
  },
  凵: {
    name: "Open box",
    note: "A box-like shape open at the top. Compare it with 冂, which is open at the bottom.",
  },
  口: {
    name: "Mouth",
    note: "A small closed box with three strokes. In 話 it sits within the larger 舌 component.",
  },
  工: {
    name: "Work",
    note: "Two horizontal bars joined by a vertical stroke. Find this complete shape under the top strokes of 左.",
  },
  广: {
    name: "Shelter",
    note: "A dot and roof with a long stroke down the left. In 店 it shelters 占.",
  },
  斤: {
    name: "Axe",
    note: "Find the angled top and long vertical stroke. In 新, this component is on the right.",
  },
  日: {
    name: "Sun / day",
    note: "A closed box with a line inside. Compare it with 目, which has two inner lines.",
  },
  曰: {
    name: "Say",
    note: "This dictionary radical resembles a wide 日. In 書, the dictionary classification and the visible bottom 日 shape are recorded separately.",
  },
  木: {
    name: "Tree",
    note: "A vertical trunk, horizontal branch and two spreading lower strokes. Find the tree at the bottom of 楽.",
  },
  水: {
    name: "Water",
    note: "Imagine a central stream with spreading splashes. 水 is both a kanji itself and a dictionary radical.",
  },
  耳: {
    name: "Ear",
    note: "Look for the tall shape and its inner horizontal lines. In 聞, the ear sits inside 門.",
  },
  艹: {
    name: "Grass",
    note: "The short grass shape sits at the top of 茶. Its full dictionary form is 艸.",
    forms: "艸 · 艹",
  },
  行: {
    name: "Walk / go",
    note: "Find the 彳 shape on the left and the separate strokes on the right. 行 is itself a dictionary radical.",
  },
  見: {
    name: "See",
    note: "Notice 目 above 儿: an eye shape above two lower strokes. Use that picture to remember seeing.",
  },
  言: {
    name: "Speech",
    note: "A stack of strokes above a small 口. In 話 and 読 it stands on the left.",
  },
  貝: {
    name: "Shell",
    note: "A tall box with two small lower strokes. Look for it below the net shape in 買.",
  },
  音: {
    name: "Sound",
    note: "Notice 立 above 日. 音 is both a complete kanji and the dictionary radical used to group it.",
  },
  食: {
    name: "Food / eat",
    note: "食 is a complete kanji. Its narrower form 飠 appears on the left of 飲.",
    forms: "食 · 飠",
  },
  飠: {
    name: "Food / eat",
    note: "The narrow food component on the left of 飲. Recognize it as a form of 食.",
    forms: "食 · 飠",
  },
  山: {
    name: "Mountain",
    note: "A central peak with two shorter side peaks. Find the mountain-like part within 出.",
  },
  丆: {
    name: "Top strokes",
    note: "This is a label for the top shape shown in 右. Learn its outline as a visual component, not as a useful standalone word.",
  },
  立: {
    name: "Stand",
    note: "A dot, a horizontal line and lower strokes over a base. Find it above 日 in 音.",
  },
  白: {
    name: "White",
    note: "A box with an inner line and a short stroke above. Compare the outline with 日 in the same lesson.",
  },
  冫: {
    name: "Ice strokes",
    note: "Two detached strokes. The structure reference uses this label for a grouped shape in 楽; it is not a rule for the character's meaning.",
  },
  占: {
    name: "Divine / fortune-telling",
    note: "A top stroke shape over 口. In 店 it sits beneath the shelter 广.",
  },
  十: {
    name: "Ten",
    note: "One horizontal and one vertical stroke cross. In 古, this shape sits above 口.",
  },
  彳: {
    name: "Step",
    note: "Three narrow strokes on the left of 行. This is a visual component used in many movement-related characters.",
  },
  目: {
    name: "Eye",
    note: "A tall box with two inner horizontal lines. In 見, find it above the lower 儿 shape.",
  },
  儿: {
    name: "Legs",
    note: "Two separated lower strokes. “Legs” is a recognition label for the shape below 目 in 見.",
  },
  欠: {
    name: "Lack / yawn",
    note: "A small upper shape over two spreading lower strokes. In 飲 it sits beside the food component.",
  },
  売: {
    name: "Sell",
    note: "Recognize this larger component on the right of 読. It can itself be broken into smaller shapes.",
  },
  聿: {
    name: "Brush",
    note: "A long central stroke passes through several shorter strokes. Find the brush shape above 日 in 書.",
  },
  舌: {
    name: "Tongue",
    note: "Look for its upper strokes and a 口 at the bottom. In 話, the whole tongue component is beside 言.",
  },
  門: {
    name: "Gate",
    note: "Two tall sides form an enclosing gate. In 聞, the gate surrounds the ear 耳.",
  },
  罒: {
    name: "Net",
    note: "A wide rectangular net shape. In 買, it sits above 貝.",
  },
  乍: {
    name: "Right-side shape",
    note: "Find this group on the right of 作. Learn its outline alongside the narrow person 亻; it is not being taught as a standalone word.",
  },
};
export const kanjiComponentStories: Readonly<Record<string, string>> = {
  水: "Picture water splashing away from a stream. Here the whole character is the radical.",
  茶: "Notice grass 艹 above 人 and 木. Imagine a person at a wooden stand beneath tea leaves: tea.",
  本: "Find 木 and the extra short mark near its base. Picture a book stored at the base of a tree.",
  円: "Find the 冂 frame around the inner strokes. Picture a yen coin kept inside a little frame.",
  入: "Watch how the two strokes meet. Imagine passing through that narrow opening: enter.",
  出: "Notice a mountain-like 山 and an open-box 凵 shape. Imagine stepping out from the box toward a mountain.",
  右: "Find 口 below the upper strokes. Picture pointing right toward someone's mouth to remember this shape.",
  左: "Find 工 below the upper strokes. Imagine holding a small work tool in your left hand.",
  日: "A box with a line inside can remind you of a bright window in the daytime: sun or day.",
  音: "Notice 立 above 日. Imagine standing in the sunlight and listening to a sound.",
  楽: "Notice the top box and side strokes above 木. Imagine music coming from a tree with decorations.",
  店: "A shelter 广 stands over 占. Picture a small shop under that roof.",
  新: "Notice 立 and 木 beside the axe 斤. Imagine cutting wood to make something new.",
  古: "Ten 十 is above mouth 口. Imagine a story told by ten mouths over many years: old.",
  行: "Find 彳 on the left and the remaining strokes on the right. Imagine taking steps along a road: go.",
  見: "Eye 目 is above the legs 儿. Imagine an eye walking around to see things.",
  食: "Recognize the complete 食 shape first. Picture food under its roof-like top; its narrow 飠 form will help with 飲.",
  飲: "Food 飠 is on the left and 欠 on the right. Imagine a yawn turning into a request for a drink.",
  読: "Speech 言 is beside sell 売. Imagine reading the words on a shop's sale notice.",
  書: "Brush 聿 is above the visible 日 shape. Imagine a brush writing inside a small square.",
  話: "Speech 言 is beside tongue 舌. Imagine a tongue making speech: talk.",
  聞: "Gate 門 surrounds ear 耳. Imagine listening with your ear beside a gate.",
  買: "Net 罒 is above shell 貝. Imagine collecting shells in a net, then using them to buy something.",
  作: "Person 亻 is beside the right-side shape 乍. Imagine a person carefully making that shape: make.",
};
export function componentPosition(position: string) {
  return (
    (
      {
        tare: "around the top and left",
        tarec: "inside",
        kamae: "enclosing",
      } as Record<string, string>
    )[position] ?? position.replaceAll("-", " ")
  );
}
