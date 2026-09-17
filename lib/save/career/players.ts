/**
 * Giải mã bản ghi cầu thủ và tính overall.
 *
 * `overall` là giá trị TÍNH, không phải giá trị đọc: nó không tồn tại trong file.
 * Mọi thứ trả về ở đây phải giữ được sự phân biệt đó tới tận UI.
 */

import { BitRecordReader } from "../bitreader";
import { OVR_FEATURE_COUNT, OVR_MODELS } from "./ovr-model";
import {
  ATTRIBUTE_FIELDS,
  ATTRIBUTE_ORDER,
  CORE_FIELDS,
  positionName,
  type AttributeName,
  type BitField,
} from "./schema";

export interface RawPlayer {
  playerId: number;
  /** Số ngày kể từ epoch Unix; `null` khi trường ngoài dải hợp lệ. */
  birthDay: number | null;
  potential: number | null;
  heightCm: number | null;
  weightKg: number | null;
  positionCode: number | null;
  nationalityId: number | null;
  internationalReputation: number | null;
  skillMoves: number | null;
  weakFoot: number | null;
  firstNameId: number | null;
  lastNameId: number | null;
  commonNameId: number | null;
  /** 0 = nam, 1 = nữ. */
  gender: number | null;
  attributes: Record<AttributeName, number | null>;
  /** Overall tính từ chỉ số. `null` khi thiếu chỉ số nên không tính được. */
  overall: number | null;
}

const read = (r: BitRecordReader, i: number, f: BitField): number | null => {
  const v = r.field(i, f.bit, f.width);
  return v === null ? null : v + f.add;
};

/**
 * Tính overall theo mô hình hồi quy của vị trí tương ứng.
 *
 * Trả `null` nếu thiếu bất kỳ chỉ số nào: một overall tính từ dữ liệu khuyết là
 * số sai đội lốt số đúng, tệ hơn hẳn việc để trống.
 */
function computeOverall(
  attributes: Record<AttributeName, number | null>,
  reputation: number | null,
  positionCode: number | null,
): number | null {
  const features: number[] = [];
  for (const name of ATTRIBUTE_ORDER) {
    const v = attributes[name];
    if (v === null) return null;
    features.push(v);
  }
  if (reputation === null) return null;
  features.push(reputation);
  if (features.length !== OVR_FEATURE_COUNT) return null;

  const weights = OVR_MODELS[positionName(positionCode)] ?? OVR_MODELS._generic;
  if (!weights) return null;

  let sum = weights[OVR_FEATURE_COUNT];
  for (let i = 0; i < OVR_FEATURE_COUNT; i += 1) sum += features[i] * weights[i];

  const rounded = Math.round(sum);
  // Kẹp về dải hợp lệ: ngoài dải chắc chắn là hỏng, không phải cầu thủ dị biệt.
  if (!Number.isFinite(rounded) || rounded < 1 || rounded > 99) return null;
  return rounded;
}

export function decodePlayer(reader: BitRecordReader, index: number): RawPlayer | null {
  const playerId = read(reader, index, CORE_FIELDS.playerId);
  if (playerId === null || playerId <= 0) return null;

  const attributes = {} as Record<AttributeName, number | null>;
  for (const name of ATTRIBUTE_ORDER) {
    attributes[name] = read(reader, index, ATTRIBUTE_FIELDS[name]);
  }

  const positionCode = read(reader, index, CORE_FIELDS.position);
  const internationalReputation = read(reader, index, CORE_FIELDS.internationalReputation);

  return {
    playerId,
    birthDay: read(reader, index, CORE_FIELDS.birthDate),
    potential: read(reader, index, CORE_FIELDS.potential),
    heightCm: read(reader, index, CORE_FIELDS.heightCm),
    weightKg: read(reader, index, CORE_FIELDS.weightKg),
    positionCode,
    nationalityId: read(reader, index, CORE_FIELDS.nationalityId),
    internationalReputation,
    skillMoves: read(reader, index, CORE_FIELDS.skillMoves),
    weakFoot: read(reader, index, CORE_FIELDS.weakFoot),
    firstNameId: read(reader, index, CORE_FIELDS.firstNameId),
    lastNameId: read(reader, index, CORE_FIELDS.lastNameId),
    commonNameId: read(reader, index, CORE_FIELDS.commonNameId),
    gender: read(reader, index, CORE_FIELDS.gender),
    attributes,
    overall: computeOverall(attributes, internationalReputation, positionCode),
  };
}

/**
 * `accept` lọc ô trống nằm xen trong bảng. Bảng cầu thủ không liền mạch: giữa
 * các bản ghi thật có ô dành sẵn, giải mã chúng sẽ ra số vô nghĩa.
 */
export function decodeAllPlayers(
  reader: BitRecordReader,
  limit: number,
  accept?: (index: number) => boolean,
): RawPlayer[] {
  const out: RawPlayer[] = [];
  const n = Math.min(reader.count, limit);
  for (let i = 0; i < n; i += 1) {
    if (accept && !accept(i)) continue;
    const p = decodePlayer(reader, i);
    if (p) out.push(p);
  }
  return out;
}
