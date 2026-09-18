/**
 * Vị trí cầu thủ: nhóm hiển thị, và ô nào trên sân thì vị trí sở trường nào hợp.
 *
 * Nằm ở `lib/` chứ không nằm trong component vì giờ có HAI nơi cần nó: bảng cầu
 * thủ (gom nhóm) và bộ dựng đội hình (xếp người vào ô). Hai bảng vị trí ở hai
 * file là cách chắc chắn nhất để về sau chúng lệch nhau mà không ai biết.
 */

export type PositionGroup = "GK" | "DF" | "MF" | "FW";

const GROUP_OF: Record<string, PositionGroup> = {
  GK: "GK",
  SW: "DF", RB: "DF", RWB: "DF", CB: "DF", RCB: "DF", LCB: "DF", LB: "DF", LWB: "DF",
  CDM: "MF", RDM: "MF", LDM: "MF", CM: "MF", RCM: "MF", LCM: "MF",
  RM: "MF", LM: "MF", CAM: "MF", RAM: "MF", LAM: "MF",
  RW: "FW", LW: "FW", RF: "FW", CF: "FW", LF: "FW", ST: "FW", RS: "FW", LS: "FW",
};

/** Vị trí lạ rơi vào tiền vệ — nhóm rộng nhất, sai ở đó ít gây hiểu nhầm nhất. */
export const groupOf = (position: string): PositionGroup => GROUP_OF[position] ?? "MF";

export const GROUP_LABEL: Record<PositionGroup, { vi: string; en: string }> = {
  GK: { vi: "Thủ môn", en: "Goalkeepers" },
  DF: { vi: "Hậu vệ", en: "Defenders" },
  MF: { vi: "Tiền vệ", en: "Midfielders" },
  FW: { vi: "Tiền đạo", en: "Attackers" },
};

export const GROUP_ORDER: PositionGroup[] = ["GK", "DF", "MF", "FW"];

/**
 * Cầu thủ sở trường nào thì hợp với ô nào trên sơ đồ.
 *
 * Bảng này nói về VỊ TRÍ SỞ TRƯỜNG đọc từ save, không phải về nhãn của ô: một ô
 * `RCB` cần người sở trường CB, không cần người có đúng chữ "RCB".
 */
const SLOT_FAMILY: Record<string, string[]> = {
  GK: ["GK"],
  SW: ["CB", "SW", "RCB", "LCB"],
  RWB: ["RB", "RWB"], RB: ["RB", "RWB"],
  RCB: ["CB", "RCB", "LCB", "SW"], CB: ["CB", "RCB", "LCB", "SW"], LCB: ["CB", "RCB", "LCB", "SW"],
  LB: ["LB", "LWB"], LWB: ["LB", "LWB"],
  RDM: ["CDM", "RDM", "LDM", "CM"], CDM: ["CDM", "RDM", "LDM", "CM"], LDM: ["CDM", "RDM", "LDM", "CM"],
  RM: ["RM", "RW"], LM: ["LM", "LW"],
  RCM: ["CM", "RCM", "LCM", "CDM", "CAM"], CM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  LCM: ["CM", "RCM", "LCM", "CDM", "CAM"],
  RAM: ["CAM", "RAM", "LAM"], CAM: ["CAM", "RAM", "LAM", "CM"], LAM: ["CAM", "RAM", "LAM"],
  RF: ["RF", "RW", "ST"], CF: ["CF", "ST"], LF: ["LF", "LW", "ST"],
  RW: ["RW", "RM", "RF"], LW: ["LW", "LM", "LF"],
  RS: ["ST", "CF", "RS", "LS"], ST: ["ST", "CF", "RS", "LS"], LS: ["ST", "CF", "RS", "LS"],
};

export const familyOf = (slotPosition: string): string[] =>
  SLOT_FAMILY[slotPosition] ?? [slotPosition];

/** Mức hợp giữa vị trí sở trường của một cầu thủ và một ô trên sân. */
export type Fit = "exact" | "family" | "group" | "out";

/**
 * Chấm độ hợp.
 *
 * Bốn bậc chứ không phải hai, vì "trái nghề" có nhiều mức rất khác nhau: một
 * tiền vệ trung tâm đá tiền vệ phòng ngự khác hẳn một thủ môn đá tiền đạo, và
 * gộp cả hai vào "không hợp" sẽ khiến bộ xếp đội hình chọn bừa giữa chúng.
 */
export function fitOf(preferred: string, slotPosition: string): Fit {
  if (preferred === slotPosition) return "exact";
  if (familyOf(slotPosition).includes(preferred)) return "family";
  if (groupOf(preferred) === groupOf(slotPosition)) return "group";
  return "out";
}

/**
 * Hệ số nhân vào chỉ số khi cầu thủ đá lệch vị trí.
 *
 * Con số không lấy từ đâu ra được — game không công bố — nên chúng chỉ cần giữ
 * đúng THỨ TỰ: hợp hẳn > cùng nhóm vị trí > cùng tuyến > trái tuyến. Chúng quyết
 * định thứ tự ưu tiên khi xếp người, không phải một con số hiển thị ra ngoài.
 */
export const FIT_WEIGHT: Record<Fit, number> = {
  exact: 1,
  family: 0.94,
  group: 0.82,
  out: 0.55,
};
