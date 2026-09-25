'use client';
import { useCallback, useEffect, useRef, useState, type DragEvent, type ClipboardEvent } from 'react';
import { AttachmentQueue, exposedFiles, type FileSource } from './queue';

export function useAttachmentQueue(disabled:boolean,onError:(message:string)=>void){
  const queue=useRef(new AttachmentQueue());
  const[files,setFiles]=useState<File[]>([]);
  const[dragging,setDragging]=useState(false);
  const depth=useRef(0);
  const resetDrag=useCallback(()=>{depth.current=0;setDragging(false);},[]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')resetDrag();};
    window.addEventListener('blur',resetDrag);window.addEventListener('dragend',resetDrag);window.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('blur',resetDrag);window.removeEventListener('dragend',resetDrag);window.removeEventListener('keydown',escape);};
  },[resetDrag]);
  const add=useCallback((incoming:File[],source:FileSource,event?:object)=>{
    if(disabled)return;
    try{setFiles(queue.current.add(incoming,source,event));onError('');}catch(error){onError(error instanceof Error?error.message:'Unable to add files.');}
  },[disabled,onError]);
  const clear=useCallback(()=>{queue.current.clear();setFiles([]);},[]);
  const remove=useCallback((index:number)=>{if(!disabled)setFiles(queue.current.remove(index));},[disabled]);
  const hasFiles=(event:DragEvent)=>Array.from(event.dataTransfer.types).includes('Files');
  const events={
    onPaste:(event:ClipboardEvent)=>{
      if(!(event.target instanceof HTMLTextAreaElement))return;
      const incoming=exposedFiles(event.clipboardData);
      if(incoming.length){
        // Keep the browser's native mixed-text paste; do not synthesize text/HTML files.
        if(!event.clipboardData.getData('text/plain').trim())event.preventDefault();
        add(incoming,'paste',event.nativeEvent);
      }else if(Array.from(event.clipboardData.items).some(item=>item.kind==='file')){
        onError('This browser could not read the clipboard file. Use Attach or drag and drop.');
      }
    },
    onDragEnter:(event:DragEvent)=>{if(!hasFiles(event))return;event.preventDefault();depth.current++;if(!disabled)setDragging(true);},
    onDragOver:(event:DragEvent)=>{if(!hasFiles(event))return;event.preventDefault();event.dataTransfer.dropEffect=disabled?'none':'copy';},
    onDragLeave:(event:DragEvent)=>{if(!hasFiles(event)&&depth.current===0)return;depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);},
    onDrop:(event:DragEvent)=>{
      resetDrag();if(!hasFiles(event)&&!event.dataTransfer.files.length)return;
      event.preventDefault();event.stopPropagation();add(exposedFiles(event.dataTransfer),'drop',event.nativeEvent);
    },
  };
  return{files,add,clear,remove,dragging,events};
}
