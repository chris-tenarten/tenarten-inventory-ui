import TenbotCanaryControl from '@/modules/tenbot/TenbotCanaryControl';
export const metadata={title:'TenBot canary control'};
export default function TenbotCanaryControlPage(){return <TenbotCanaryControl mode={process.env.NEXT_PUBLIC_TENBOT_CANARY_CONTROL_MODE??'off'}/>;}
