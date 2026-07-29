export const JOB_TRANSMITTAL_PDF_VERSION = "job-transmittal-pdf-v1";
export const FIRST_PAGE_ROWS = 5;
export const CONTINUATION_PAGE_ROWS = 13;

const text = (value) => value == null ? "" : String(value);
const date = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(value));
  return match ? `${Number(match[2])}/${Number(match[3])}/${match[1]}` : text(value);
};
const chunks = (value, limit) => {
  const source = text(value);
  if (!source) return [""];
  const result = [];
  for (const paragraph of source.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (word.length > 36) {
        if (current) { result.push(current); current = ""; }
        for (let index = 0; index < word.length; index += 36) result.push(word.slice(index,index+36));
        continue;
      }
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > limit) { if (current) result.push(current); current = word; }
      else current = candidate;
    }
    if (current) result.push(current);
  }
  return result.length ? result : [""];
};

export function buildJobTransmittalPdfModel(snapshot, options = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("The Letter of Transmittal snapshot is invalid.");
  }
  const sourceItems = Array.isArray(snapshot.items) ? snapshot.items : [];
  const renderItems = sourceItems.length || !options.allowEmptyItems
    ? sourceItems
    : [{ submittal: "", quantity: "", date: "", number: "", description: "" }];
  const items = renderItems.flatMap((item) => chunks(item.description, 150).map((description,index) => ({
    ...item,
    submittal:index ? "Description continued" : item.submittal,
    quantity:index ? "" : item.quantity,
    date:index ? "" : item.date,
    number:index ? "" : item.number,
    description,
  })));
  if (!items.length) throw new Error("The Letter of Transmittal has no transmitted items.");
  const pages = [items.slice(0, FIRST_PAGE_ROWS)];
  for (let index = FIRST_PAGE_ROWS; index < items.length; index += CONTINUATION_PAGE_ROWS) {
    pages.push(items.slice(index, index + CONTINUATION_PAGE_ROWS));
  }
  return {
    documentVersion: JOB_TRANSMITTAL_PDF_VERSION,
    templateVersion: Number(snapshot.template_version) || 1,
    transmittalNumber: text(snapshot.transmittal_number)
      || (options.allowBlankTransmittalNumber ? "" : "PROVISIONAL"),
    documentDate: date(snapshot.document_date),
    job: {
      id: text(snapshot.job_id),
      number: text(snapshot.job_number),
      name: text(snapshot.job_name),
      customer: text(snapshot.customer),
    },
    recipient: {
      company: text(snapshot.recipient?.company),
      addressLine1: text(snapshot.recipient?.address_line_1),
      addressLine2: text(snapshot.recipient?.address_line_2),
      attention: text(snapshot.recipient?.attention),
      officePhone: text(snapshot.recipient?.office_phone),
      mobilePhone: text(snapshot.recipient?.mobile_phone),
      email: text(snapshot.recipient?.email),
    },
    cc: text(snapshot.cc),
    delivery: {
      attached: Boolean(snapshot.delivery?.attached),
      separateCover: Boolean(snapshot.delivery?.separate_cover),
      via: text(snapshot.delivery?.via),
    },
    types: {
      shopDrawing: Boolean(snapshot.transmitted_types?.shop_drawing),
      letter: Boolean(snapshot.transmitted_types?.letter),
      samples: Boolean(snapshot.transmitted_types?.samples),
      other: Boolean(snapshot.transmitted_types?.other),
      otherLabel: text(snapshot.transmitted_types?.other_label),
    },
    pages: pages.map((page) => page.map((item) => ({
      submittal: text(item.submittal),
      quantity: text(item.quantity),
      date: date(item.date),
      number: text(item.number),
      description: text(item.description),
    }))),
    purpose: {
      approval: Boolean(snapshot.purpose?.approval),
      use: Boolean(snapshot.purpose?.use),
      record: Boolean(snapshot.purpose?.record),
      rfi: Boolean(snapshot.purpose?.rfi),
      review: Boolean(snapshot.purpose?.review),
      reviewBy: date(snapshot.purpose?.review_by),
    },
    comments: text(snapshot.comments),
    commentPages: chunks(snapshot.comments, 300),
    sender: {
      name: text(snapshot.sender?.name),
      phone: text(snapshot.sender?.phone),
      email: text(snapshot.sender?.email),
    },
  };
}
