/** Product-approved rotary-tool mark, simplified for Messaging avatar sizes. */
export function TenbotAvatar({className=''}:{className?:string}){
 return <svg data-tenbot-avatar aria-hidden="true" focusable="false" viewBox="0 0 128 128" width="32" height="32" className={className}>
  <circle cx="64" cy="64" r="64" fill="#19365f"/>
  <circle cx="64" cy="64" r="63.5" fill="none" stroke="#ffffff" strokeOpacity=".18"/>
  <g fill="none" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
   <path d="M36 86c-8 3-5 13-17 15"/>
   <path d="M36 82c2-6 27-27 38-31 3-1 5-2 8-2l6-4c2-1 3-1 5 1l7 11c2 3 1 5-2 7l-5 4c-4 8-18 18-32 24-6 3-12 4-18 4-3 0-4-1-5-4l-3-7c-1-2-1-2 1-3Z"/>
   <path d="m43 73 9 22M50 80l7-4m-5 9 7-4m-5 9 7-4"/>
   <path d="m60 62 8-6c2-2 5 1 3 3l-8 6c-3 2-5-1-3-3Z"/>
   <path d="M80 50c0 9 4 15 11 20m-3-25c-1 8 3 14 10 19"/>
   <path d="m94 47 3-2c2-1 3-1 4 1l4 6c1 2 1 3-1 4l-3 2m1-11 5-3 3 4-5 4"/>
   <path d="m107 44 7-5c2-1 4-1 4 1v2l-8 6m1-7 4 2"/>
   <path d="M47 33c-2 9-3 10-12 12 9 2 10 3 12 12 2-9 3-10 12-12-9-2-10-3-12-12Z"/>
   <path d="M61 31v6m-3-3h6"/>
  </g>
 </svg>;
}
