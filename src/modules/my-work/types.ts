export type WorkTaskVisibility='private'|'shared';
export type WorkTaskColor='neutral'|'blue'|'teal'|'green'|'yellow'|'orange'|'rose'|'violet';
export type WorkTask={id:string;title:string;notes:string;visibility:WorkTaskVisibility;creatorUserId:string;creatorName:string;assigneeUserId:string;assigneeName:string;dueDate:string;estimatedMinutes:number|null;contextType:string;contextId:string;jobNumber:string;jobName:string;jobCustomer:string;color:WorkTaskColor;groupId:string;groupName:string;groupColor:WorkTaskColor|null;attachmentCount:number;completedAt:string;createdAt:string;updatedAt:string};
export type WorkTaskGroup={id:string;name:string;color:WorkTaskColor;createdAt:string;updatedAt:string};
export type WorkCollaborator={userId:string;displayName:string;role:string};
export type WorkJob={id:string;jobNumber:string;name:string;customer:string};
export type WorkTaskAttachment={id:string;taskId:string;uploaderUserId:string;storagePath:string;originalFilename:string;contentType:string;byteSize:number;createdAt:string};
