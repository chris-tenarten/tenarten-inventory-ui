// Reviewed supplemental employee workflows from the external October 27 package. Server only.
// Retain package identity and pinned source hashes; edit prose only after source/release review.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- shared with Next and Deno
// @ts-ignore -- Deno requires explicit .ts imports; this type import has no runtime cycle.
import type {CapabilityEntry} from './tenbot-knowledge.ts';
export const workflowSupplementSnapshot = {
  "schemaVersion": 1,
  "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
  "verifiedAt": "2026-10-27",
  "packageId": "tenops-deployed-knowledge-20261027",
  "packageSha256": "63c356867c92eaac60256610b90cf177afa77629b595c94099a3b885e62522c4",
  "entryCount": 24,
  "sourceCount": 57,
  "source": "Selective reviewed supplement; existing precise workflows and generated release sources retain authority"
} as const;
export const workflowSupplementSources = [
  {
    "path": "docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "4af4f03154f9e39bdac724cffc2800f3ddf3e088",
    "sha256": "873d2d0eb6f0538d631a5d537d14daeeeaca094fe6ca8a38317260a251dd86f2"
  },
  {
    "path": "docs/workflows/LETTER_OF_TRANSMITTAL.md",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "752fc545a07e9a284af87b00eb7434d1fd18d76b",
    "sha256": "a46f3dd27bc79f5e735784dce9c344616ea8206fde2996f0eae0713687bf8af4"
  },
  {
    "path": "docs/workflows/MATERIAL_USAGE.md",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "563bc7e922c405767494baad65b1a820b1397c2d",
    "sha256": "b446b21b29fd13d29cc3405a7043344aa101ff05d0fda85895bab477803c9190"
  },
  {
    "path": "docs/workflows/PURCHASING.md",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "8bf5f2e4a1e5d1680307916cbd2e8751b1e56c57",
    "sha256": "2ef556ec180beea3b4ff78a5483b5b4bf4f71561b570a0d2fa3ed1d72b8a7c98"
  },
  {
    "path": "src/app/catalog/page.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "c2fb7e57a2aa0a07c6c8e8108943dbe15f9a7f4d",
    "sha256": "5c4f736316e44dc204b8208610f6e4fab98ec39fcadfaf4de0c49c1e19d83cea"
  },
  {
    "path": "src/app/client-layout-shell.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "08e52e6de00c69e6607feb25c934a421bbb45974",
    "sha256": "f310f25d16233a45adfc20a18b55ff51f21b52920923737aa0a33f934b0273a2"
  },
  {
    "path": "src/app/settings/page.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "66f6e95ed227047b2b50b7975fba086d45bbd110",
    "sha256": "8332dfe5dd52ca9ce4112cf06105a3b64a89aea2b8513bc67f8f4bf0cead2238"
  },
  {
    "path": "src/components/BusinessWriteControls.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "cd2aa7035bf47667522fe754784e93006ba243e2",
    "sha256": "84579e28ccc88119267b88566bfc6bbe3e0e6c4590caa79d58fd5c2ae45b8bf9"
  },
  {
    "path": "src/components/ToolboxLauncher.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "7c3730de2d29aa386ce718a92e9734c1208ffdf0",
    "sha256": "80883186c0570d3e2a00b435385fcc10cd8813fa916934b91d92df9b7bdd0a5c"
  },
  {
    "path": "src/lib/account-preferences.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "f10e6c6c64976d060da63e1a979a52867f88a598",
    "sha256": "dc4ae30e4cab17fb8fba870aa2e93000bff1c6d84e07787feacc7c37aada09d6"
  },
  {
    "path": "src/lib/appearance.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "328686163d8d51abf2bdb260199bb51f5414d952",
    "sha256": "019387eca9f791aa16bf38d1189236c81351fa5f8dc60e6f645b0495b5c2f7ac"
  },
  {
    "path": "src/lib/drafts/textDraft.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "e0cf9938a40b45cd52fc1c7d4725ba3c1157959b",
    "sha256": "ad154f14b46211a21d960e2807156d698da878093268021dc8e6bec95106d6d9"
  },
  {
    "path": "src/lib/drafts/useTextDraft.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "72eb08bad9e5f58b50de0ddfd128051bccf8b48f",
    "sha256": "4b75171141382564d1d8c9fa012b631acd028f903f1eac5f0c517b572814f8c7"
  },
  {
    "path": "src/lib/rbac.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "0a8842933a4e2267679b730dab20b0cb7d7e9a4c",
    "sha256": "dc42f66fccd7e58c56c7481d93bc76fd88c6d7fdab336e02f027647ba12ea2b5"
  },
  {
    "path": "src/modules/intake-materials/HistoricalImport.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "cf594acff82e68a8119756b423c029aad0c76f87",
    "sha256": "4e0cf462f364723055a29c290fd3bc8654eb61b9dd82de45c2edd1ea730fde0e"
  },
  {
    "path": "src/modules/manpower/ManpowerAnalytics.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "cd032f4b6c240ec7d3231d51777219540c63ce4a",
    "sha256": "0ab20c0a69e8e26dfc13a3d9a60de64a8ffdf9e6869976f70b6df741caf8a001"
  },
  {
    "path": "src/modules/manpower/ManpowerWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "c5d64c5429b5f9d0c0411d433a8e3bdf788537ed",
    "sha256": "7df2c298a3aa6e348e180b8bbf4e48b662b9ff82018708f91fdb799a87ca057f"
  },
  {
    "path": "src/modules/manpower/manpower.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "fb04b98154121ee5e5f1af769bfc7e5e503654fd",
    "sha256": "44bc34bfc9452c645aec3f5826edb289b179a4e0ca71821277ac6fb278ab5384"
  },
  {
    "path": "src/modules/material-usage/MaterialUsageEditor.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "66f9db4b1033984ba7c2eae6fa5355fe5bc9a847",
    "sha256": "22bfe9ccfdffc36c3a30ae6f5dc9c1b1580cfef5c130e923ff22ea7c9ffe4556"
  },
  {
    "path": "src/modules/material-usage/MaterialUsageHistory.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "009a3fe806e65423ef54858e5d044b550782a232",
    "sha256": "8a74f048450f4abbf5512f072d888dbfb68f8901adae856f3bd2a0b6554f0ddb"
  },
  {
    "path": "src/modules/material-usage/MaterialUsageWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "2a0d8ec55799349b7a611bbb17c178522b79b8bf",
    "sha256": "1c82effa53ce6fd975dff3f6c93c3e567e66c132964bc03a77b9b89ff9d0e63d"
  },
  {
    "path": "src/modules/material-usage/actions.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "336ad9e4260e7cf3ee7c7f48e0d62bb6ca0f45f6",
    "sha256": "f9dd9be9c2d48e7faa2b0ba8abb531ef0dde44412e04a0841f2ab6fb814a21d6"
  },
  {
    "path": "src/modules/my-work/InboxDialog.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "1e2fe3d86211d6819f0b38170e305ee4142764bf",
    "sha256": "f31a14646e20f16bd5145d2461cb2617e2b3cc8b51d0de147b2120bbbe298c3f"
  },
  {
    "path": "src/modules/my-work/MyWorkPage.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "d6836f0e27f83df9324136afefcb23f3c2094fa9",
    "sha256": "702ccd6bae99490c3bfab00e878a4eafdac0b460b26a4696435ff30372235d6a"
  },
  {
    "path": "src/modules/my-work/queries.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "236d4937bc6940aa5f0e46cf8e49178c7c000430",
    "sha256": "3d21c361e0705a91d553e4513943541590e4dde3f4248e806413bacd923f3877"
  },
  {
    "path": "src/modules/pre-production/BidPlanningCard.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "dd657cb5b55a97160c0546c8b0410702373a739e",
    "sha256": "747c81319bc9d9e62c5bf67172965992ea9221d34377622e191b3b865b17535f"
  },
  {
    "path": "src/modules/pre-production/BidWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "5a4db36d21a9ca6b89a6b686a91befcf214be6c4",
    "sha256": "8b74be3c5dfc5be6b4c7216020d36fece3bce28cf64d6eb614eaf08363e090bb"
  },
  {
    "path": "src/modules/pre-production/planning-data.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "f7a84915fb00398482bc483c2f3c6e077608f9a0",
    "sha256": "a9230a1a79e844a7961d077e4e24b2902635845fd8acdb50b40cf2ff9400267e"
  },
  {
    "path": "src/modules/pre-production/queries.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "a4c895542fe7227ac68d6191733ce4b621ca9e9f",
    "sha256": "5ab234d43e541779af4236f824910c9c488c3e857833521e80b1402b28ade4a3"
  },
  {
    "path": "src/modules/production/ProductionWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "b5ad77cf4a4b2a1425743f1628cd1afbcd2c7fbf",
    "sha256": "6cd2e6b6b86c4e0f32b64202046c7b19f15118e6ec829d8bb0eefdf7b03285e6"
  },
  {
    "path": "src/modules/production/components/MonthlySnapshot.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "7e63b670be0fd694060e7b2d9a3ca87f8003d422",
    "sha256": "4810e6808652945eb625de8cd24e0d490f88cb214931a10263abc121e28cd8ad"
  },
  {
    "path": "src/modules/production/components/ProductionJobInspector.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "51762b1470af70061c9dbd8844444c195892f345",
    "sha256": "66160963071a4c2170d9037f7b78e52077d4c6e4be0b1b3fca0d6cb5d9865075"
  },
  {
    "path": "src/modules/production/jobs.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "9db7ef3fa0aced661100bf292fccb8462a6b4113",
    "sha256": "57e2f002d27a5dc4d6bcd9965d90806ed09cbd39705e934a1bf2c25784394c2e"
  },
  {
    "path": "src/modules/production/snapshot.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "9a779d40fd71e626e1d4f1742c3daa512e6b550f",
    "sha256": "eb992331376ea20288147928e4e9461b67bb570cca96c7b806b52376ba3baaab"
  },
  {
    "path": "src/modules/purchasing/LineAllocations.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "1f676464c4a7f3ab944de95f6526bba50af903c1",
    "sha256": "058f5ebb4f796cac3f7ac954bb5d25835b3fee9d7023c99fa4ecde548837b2d1"
  },
  {
    "path": "src/modules/purchasing/PendingReceivalsReviewDialog.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "122473faa1ec652ec17da4f49f3e2dfb2432d069",
    "sha256": "9d3d8729b8fd1be90814e97f24615eacc748b9b2d0be572e6c72b6f4c6c4e891"
  },
  {
    "path": "src/modules/purchasing/PurchaseOrderEditor.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "ec8b518634828ee8662446a42c1df4d4938800d2",
    "sha256": "a711c17209c8b81e39b2147e08ef6baeee3cc97b452e07e7c667922d87e12aa1"
  },
  {
    "path": "src/modules/purchasing/PurchasingWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "b390fbc92dac38a638e96b011992f43e244e282a",
    "sha256": "b8001cc33695f4b824d0f5f9877c2a005463aaf5125e83fb20b49402937392b4"
  },
  {
    "path": "src/modules/purchasing/mutations.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "f7c91409dcbf085f7c316dd1a254e7735721f534",
    "sha256": "6a9c6d93c55130f854efd8ca362a647ae9a7eb331a7362e551cbfdf0f8a06f95"
  },
  {
    "path": "src/modules/samples/ColorPlateLabelEditor.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "de10ea960233a06222479b75d9b2cf09bbdb765d",
    "sha256": "24d5911b195581007eaf8beb9527b478b144abb35222f9e7777879de50debd47"
  },
  {
    "path": "src/modules/samples/SamplePourPlanner.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "d5915227e021d71fb8b88eab6f56eceae005ed3e",
    "sha256": "b93d8754322b9b7d430b2e67683dd857b9de638819659fec3f980f93f3a6f49b"
  },
  {
    "path": "src/modules/samples/SampleVersionHistory.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "39c50331e53e9cdecbdc2c81fad111e1207a6e4a",
    "sha256": "e8763a20aa36b8059917a42a358c1e6a64fd72cb171298f75d10021c43f2f04d"
  },
  {
    "path": "src/modules/samples/queries.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "d2417e47f62d4ee56472f472fa120a96226e5782",
    "sha256": "67e87ec4bbb9385e98933aca3323cddc14c41af55d277ef4332788128045cd16"
  },
  {
    "path": "src/modules/transmittals/JobTransmittalPanel.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "9449fa0ab8dbb2efd9967a3adcf26e74d4c4166a",
    "sha256": "2070e7ac39f96ff89ec14e4a03d065b34c51b42fc2396f7540d0d3174ed7ad28"
  },
  {
    "path": "src/modules/transmittals/TransmittalWorkspace.tsx",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "c702038ba58fb393ac33b1240e3156f4df812397",
    "sha256": "7c0d088660d7368f4bb2d96b1ac06b3e0e6e9b5f521ded638f506ba98128bddd"
  },
  {
    "path": "src/modules/transmittals/mutations.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "e511f925375bcb26c7a62d555a6dd8bc3beb8df3",
    "sha256": "cba97708e3c92ba059a31c01c7aff13e7c36c9c4280fb8412451e3f5f1c0422a"
  },
  {
    "path": "supabase/functions/generate-job-transmittal-pdf/index.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "f09cf58ce5473f11fe52053e1a083c63f08ad2e5",
    "sha256": "41ebbf170cd8efd708a508e6f81b1d02ed86ed0596fae9e21bd02f675b82f0a2"
  },
  {
    "path": "supabase/functions/generate-purchase-order-pdf/index.ts",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "99ff54a7f7adf6eecb189ba4f4b01b9c9fd91e8d",
    "sha256": "f42b9421b2991799cf5f27ecaea578f2868e66d52037092c02dfc8b97a989c41"
  },
  {
    "path": "supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "29f5c415b20c7592b375d281c563aa13a825608f",
    "sha256": "279f581ba29d1bb1c4282aa0831ccfd44c10fc21a3ba8f1f656001aacc0c59d4"
  },
  {
    "path": "supabase/migrations/20260831_015_my_work_task_attachments.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "3d6c4dbd332bee370731e525c8ee900d02c83d89",
    "sha256": "f4f23e74f928bf31b2e4cc550c41de8b3dd029f0420db40690be0559b484f7c8"
  },
  {
    "path": "supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "8353f575e6aed58d7c2c3cfa7eb098dd0d9e5d3b",
    "sha256": "3fbb94900282e8e742083c64a2403d8d69a299328203542ce30472c7b9d00c85"
  },
  {
    "path": "supabase/migrations/20260831_021_my_work_task_estimated_time.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "121127d1dca067607af978f55d1f5ff8d742b338",
    "sha256": "dc7faf2f00c1e7315a9586656e029b11467ebbab1b6e01f3c5f692fd8d0a0ad8"
  },
  {
    "path": "supabase/migrations/20260902_004_my_work_task_groups.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "eaafba036dcf3b06b292b7c513e488f67a836c4a",
    "sha256": "7717b61cc76d2c4138331146d55ccbb4edd6c6cdd0a00efe3c41f5f031d1c8b4"
  },
  {
    "path": "supabase/migrations/20260923220000_intake_projected_planning.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "ed4f77d841d7d35f3f3f038eb07fc5be2301a4ab",
    "sha256": "bb089eed546ce961cde531635bcbc57659619cd6e98696fbc6b81db397ca07db"
  },
  {
    "path": "supabase/migrations/20261022120000_messaging_groups_replies.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "89440ba8975b0a708e2dedab7caa48801485ced1",
    "sha256": "0a8dd986f9cb7f149e819ec2cb9c5c0e15815f9e1e414038167a7d85b7ef2401"
  },
  {
    "path": "supabase/migrations/20261026100000_historical_sample_import.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "195c8c3eaf2ae7224a9e3b79e7e26d2a6a4703eb",
    "sha256": "ccac4d685188e59c2dc23696e326d65b1aa71218e51b4b66b35012d7f89ac35f"
  },
  {
    "path": "supabase/migrations/20261026120000_bid_scope_production_handoff.sql",
    "revision": "bc628bdafea374f6a5fd446d7e924ff9d65918bf",
    "blob": "98880b863e5e0794c561b8f6e0bb0a6581a37717",
    "sha256": "485eb06f150cac1eb0606275a16fa8bf1fdd105674c3e5934ab3f92c34c01d4b"
  }
];
export const workflowSupplement:(CapabilityEntry & {externalRecordIds:string[]})[] = [
  {
    "id": "workflow-intake-bid",
    "title": "Create and maintain an Intake Bid",
    "externalRecordIds": [
      "intake-queue",
      "intake-details"
    ],
    "modules": [
      "intake"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "viewIntake",
      "accessIntake",
      "writeBusinessData"
    ],
    "terms": "bid bids intake create new customer project owner active won lost details overview edit save deposit date",
    "requiredTerms": [
      [
        "bid",
        "bids",
        "intake"
      ],
      [
        "create",
        "new",
        "edit",
        "details",
        "overview"
      ]
    ],
    "status": "deployed",
    "route": "/pre-production",
    "path": "Intake → Pipeline → New Bid; Bid → Overview",
    "guidance": "Open Intake and choose New Bid. Enter Customer and Project Name, then Create Bid. The new Bid starts Active and defaults its owner to you. Open the Bid to edit Overview details and choose Save Bid. Saved Won status plus Deposit Received Date are required for conversion. Creating a Bid does not create a Production Job; unsaved Overview edits are not carried into conversion.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I create a Bid in Intake?"
    ],
    "sourceFiles": [
      "src/app/client-layout-shell.tsx",
      "src/modules/pre-production/BidWorkspace.tsx",
      "src/modules/pre-production/queries.ts"
    ]
  },
  {
    "id": "workflow-intake-activity",
    "title": "Bid Updates and working files",
    "externalRecordIds": [
      "intake-updates",
      "intake-files"
    ],
    "modules": [
      "intake"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "viewIntake",
      "accessIntake",
      "writeBusinessData"
    ],
    "terms": "bid bids intake updates update files file photo photos attach upload working activity add text",
    "requiredTerms": [
      [
        "bid",
        "bids",
        "intake"
      ],
      [
        "updates",
        "update",
        "files",
        "file",
        "photo",
        "photos",
        "upload"
      ]
    ],
    "status": "deployed",
    "route": "/pre-production",
    "path": "Intake → Bid → Updates / Files",
    "guidance": "Open the saved Bid. In Updates, write the operational note and choose Add Update; this saves independently of unsaved Overview details. In Files, select files or a camera photo, then review previews or open the file in your browser. Each file may be up to 25 MB. Working files are separate from issued generator history. If an Update saves but refreshing history fails, reopen before reposting to avoid a duplicate.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I add Updates or files to a Bid?"
    ],
    "sourceFiles": [
      "src/modules/pre-production/BidWorkspace.tsx",
      "src/modules/pre-production/queries.ts"
    ]
  },
  {
    "id": "workflow-intake-convert",
    "title": "Convert an eligible Bid into one Production Job",
    "externalRecordIds": [
      "intake-convert"
    ],
    "modules": [
      "intake",
      "production"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "viewIntake",
      "accessIntake",
      "createProductionJob",
      "writeBusinessData"
    ],
    "terms": "bid bids intake convert conversion production job won deposit received date handoff carry forward later canonical scope",
    "requiredTerms": [
      [
        "bid",
        "bids",
        "intake"
      ],
      [
        "convert",
        "conversion",
        "handoff"
      ]
    ],
    "status": "deployed",
    "route": "/pre-production",
    "path": "Intake → Bid → Overview → Projected Production Window → Convert to Production",
    "guidance": "Save Won status and Deposit Received Date, then save or discard remaining Bid edits and finish pending file cleanup. In Projected Production Window, choose Convert to Production. Choose Plan in Production Later to leave the Job unscheduled. Committing dates through Carry Forward or Set New Dates additionally requires Production scheduling permission. Job number is optional and is not allocated automatically. Choose Confirm conversion, then Open Production Job. The handoff creates or returns exactly one canonical Job; retrying does not create another. Accepted scope, formulation verification and material assessment are not prerequisites. Existing Bid and issued-document history remain intact; Production then owns operational scheduling.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I convert a Won Bid to Production?"
    ],
    "sourceFiles": [
      "src/modules/pre-production/BidPlanningCard.tsx",
      "src/modules/pre-production/planning-data.ts",
      "supabase/migrations/20260923220000_intake_projected_planning.sql",
      "supabase/migrations/20261026120000_bid_scope_production_handoff.sql"
    ]
  },
  {
    "id": "workflow-historical-import",
    "title": "Transcribe a historical Sample while retaining its original",
    "externalRecordIds": [
      "samples-historical-import"
    ],
    "modules": [
      "samples"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "sample samples historical import excel xlsx pdf workbook sheet page original extract transcribed documented retain batch yield",
    "requiredTerms": [
      [
        "sample",
        "samples"
      ],
      [
        "historical",
        "import",
        "transcribed"
      ]
    ],
    "status": "deployed",
    "route": "/samples",
    "path": "Samples → Historical Sample import",
    "guidance": "Open Historical Sample import, choose an original Excel workbook or PDF and one sheet or page, then Extract for review. Review warnings and extracted values, correct details and add missing material rows. Choose Retain original & save Transcribed Sample. Historical numbers remain unchanged; no new number is allocated. Open the saved Sample to review its Resin System, geometry and quantities in the existing editor and save changes. Missing Batch or yield values remain unresolved. Transcription does not verify the formulation. Compatibility with populated historical Excel files remains a release acceptance limitation.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I import a historical Sample from Excel?"
    ],
    "sourceFiles": [
      "src/modules/intake-materials/HistoricalImport.tsx",
      "supabase/migrations/20261026100000_historical_sample_import.sql"
    ]
  },
  {
    "id": "workflow-historical-verify",
    "title": "Explicitly verify a transcribed historical formulation",
    "externalRecordIds": [
      "samples-historical-import"
    ],
    "modules": [
      "samples"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "production_blend.manage"
    ],
    "terms": "sample samples historical verify verified verification formulation current evidence revision original transcribed",
    "requiredTerms": [
      [
        "sample",
        "samples"
      ],
      [
        "verify",
        "verified",
        "verification"
      ]
    ],
    "status": "deployed",
    "route": "/samples",
    "path": "Samples → Historical Sample import → Verification evidence → Verify current formulation",
    "guidance": "Historical verification requires operational access, business-write permission and the explicit Production Blend management grant. First open the transcribed Sample, check the original, review its Resin System and quantities, and save the formulation. In Historical Sample import, enter Verification evidence and choose Verify current formulation beside that record. Verification captures the checked Sample revision. Later edits require another verification; a changed revision during verification requires refresh and review. Documented, Transcribed and Verified remain separate states.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I verify a historical Sample formulation?"
    ],
    "sourceFiles": [
      "src/modules/intake-materials/HistoricalImport.tsx",
      "supabase/migrations/20261026100000_historical_sample_import.sql"
    ]
  },
  {
    "id": "workflow-po-draft",
    "title": "Save and preview a Purchase Order draft",
    "externalRecordIds": [
      "purchasing-library",
      "purchasing-preview"
    ],
    "modules": [
      "purchasing"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "createPurchaseOrderDraft",
      "previewOperationalDocuments"
    ],
    "terms": "purchase order orders po purchasing draft new create save preview pdf vendor material library unissued",
    "requiredTerms": [
      [
        "purchase",
        "order",
        "orders",
        "po",
        "purchasing"
      ],
      [
        "draft",
        "preview"
      ]
    ],
    "status": "deployed",
    "route": "/purchasing",
    "path": "Toolbox → Tools → PO Generator → Save Draft / Preview Draft PDF",
    "guidance": "Open Toolbox → Tools → PO Generator and create an unlinked draft, or launch a Purchase Order from a Production Job. Enter vendor, document and material details, then Save Draft. The first successful save assigns a stable PO number. Preview Draft PDF saves and reloads the draft before rendering, unless an unchanged cached preview is reused. Preview remains marked DRAFT and does not issue the PO. If rendering fails after saving, reopen the saved draft in the library. Preview access and draft-creation permission are required in addition to business-write permission.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I preview a Purchase Order draft?"
    ],
    "sourceFiles": [
      "docs/workflows/PURCHASING.md",
      "src/components/ToolboxLauncher.tsx",
      "src/modules/purchasing/PurchaseOrderEditor.tsx",
      "src/modules/purchasing/PurchasingWorkspace.tsx",
      "src/modules/purchasing/mutations.ts",
      "supabase/functions/generate-purchase-order-pdf/index.ts"
    ]
  },
  {
    "id": "workflow-po-issue",
    "title": "Issue a Purchase Order and recover its permanent PDF",
    "externalRecordIds": [
      "purchasing-issue"
    ],
    "modules": [
      "purchasing"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "issuePurchaseOrder",
      "previewOperationalDocuments"
    ],
    "terms": "purchase order orders po purchasing issue issued permanent pdf retry failed failure generate download immutable",
    "requiredTerms": [
      [
        "purchase",
        "order",
        "orders",
        "po",
        "purchasing"
      ],
      [
        "issue",
        "issued",
        "permanent",
        "retry"
      ]
    ],
    "status": "deployed",
    "route": "/purchasing",
    "path": "PO Generator → saved draft → Issue Purchase Order → Permanent PDF",
    "guidance": "Save the validated draft and resolve unsaved changes before choosing Issue Purchase Order and confirming. Issuance captures immutable header and ordered-line values. In Permanent PDF, use Generate PDF, Retry PDF Generation after failure, or Open / Download when ready. A PDF failure does not undo issuance: retry the same issued record instead of creating another PO. If the draft changed concurrently, reload and review it before issuing. Issued editing and revision creation are not available in this released workflow.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I issue a Purchase Order and retry its PDF?"
    ],
    "sourceFiles": [
      "src/components/ToolboxLauncher.tsx",
      "src/modules/purchasing/PurchaseOrderEditor.tsx",
      "src/modules/purchasing/mutations.ts",
      "supabase/functions/generate-purchase-order-pdf/index.ts"
    ]
  },
  {
    "id": "workflow-po-allocations",
    "title": "Allocate ordered units to canonical Jobs",
    "externalRecordIds": [
      "purchasing-allocations"
    ],
    "modules": [
      "purchasing",
      "inventory"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "createPurchaseOrderDraft"
    ],
    "terms": "purchase order orders po purchasing allocate allocation allocations allocated job jobs quantities quantity order units remainder bags pails",
    "requiredTerms": [
      [
        "purchase",
        "order",
        "orders",
        "po",
        "purchasing"
      ],
      [
        "allocate",
        "allocation",
        "allocations"
      ]
    ],
    "status": "deployed",
    "route": "/purchasing",
    "path": "PO Generator → draft material line → Allocate → Add Job allocation → Save Draft",
    "guidance": "On a draft PO material line, choose Allocate, then Add Job allocation. Select each canonical Production Job and enter its quantity in the PO order unit, such as bags or pails, rather than package contents. Review the allocated total and general-stock remainder, resolve validation errors, then Save Draft. When the resulting incoming material is received, allocated units become Job-reserved stock and the remainder stays general stock. The document-level Job context alone does not allocate material.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I allocate Purchase Order quantities to Jobs?"
    ],
    "sourceFiles": [
      "src/components/ToolboxLauncher.tsx",
      "src/modules/purchasing/LineAllocations.tsx",
      "src/modules/purchasing/mutations.ts"
    ]
  },
  {
    "id": "workflow-po-receivals",
    "title": "Project issued Purchase Order lines into Pending Receivals",
    "externalRecordIds": [
      "purchasing-receivals"
    ],
    "modules": [
      "purchasing",
      "inventory"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "issuePurchaseOrder",
      "adjustInventory"
    ],
    "terms": "purchase order orders po purchasing pending receivals create remaining lines project projection generated pdf eta allocation inventory",
    "requiredTerms": [
      [
        "purchase",
        "order",
        "orders",
        "po",
        "purchasing"
      ],
      [
        "pending",
        "receivals"
      ]
    ],
    "status": "deployed",
    "route": "/purchasing",
    "path": "Issued PO → Pending Receivals → Create Pending Receivals / Create Remaining Lines",
    "guidance": "Open the issued PO after its permanent PDF is generated. Under Pending Receivals, choose Create Pending Receivals or Create Remaining Lines. Select eligible remaining lines and review material, size or category, ordered quantity and unit, ETA and location, then confirm creation. Existing created lines remain locked to prevent duplicates. ETA starts blank because requested delivery is not material arrival. Captured allocation intent locks the associated material, quantity and unit. Use View Pending Receivals to continue in Inventory; incoming rows become on-hand stock only after receiving. Existing issue, Inventory-adjustment and business-write permissions are required.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I create Pending Receivals from a Purchase Order?"
    ],
    "sourceFiles": [
      "src/components/ToolboxLauncher.tsx",
      "src/modules/purchasing/PendingReceivalsReviewDialog.tsx",
      "src/modules/purchasing/PurchaseOrderEditor.tsx",
      "src/modules/purchasing/mutations.ts",
      "supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql"
    ]
  },
  {
    "id": "workflow-material-usage",
    "title": "Record and reopen Material Usage reports",
    "externalRecordIds": [
      "material-usage-record-report",
      "material-usage-find-history"
    ],
    "modules": [
      "material-usage"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "material usage report reports consumption consumed materials quantity quantities unit units date save history record new find search",
    "requiredTerms": [
      [
        "material",
        "usage"
      ],
      [
        "report",
        "reports",
        "record",
        "history",
        "consumption"
      ]
    ],
    "status": "deployed",
    "route": "/material-usage",
    "path": "Reporting → Material Usage → New → Save Report; history sidebar",
    "guidance": "Open Reporting → Material Usage and create a new report. Select a canonical Production Job, or explicitly confirm a temporary work label, and enter the report date. Add material type, manufacturer, name, quantity, unit and notes on each line, then choose Save Report. Use the history sidebar search and filters to find and reopen the saved report with its ordered lines. Reports retain entered identity snapshots and authorship. Recording consumption does not automatically decrement Inventory or consume a reservation. A temporary label does not create a Job.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I record a Material Usage report?"
    ],
    "sourceFiles": [
      "docs/workflows/MATERIAL_USAGE.md",
      "src/components/BusinessWriteControls.tsx",
      "src/modules/material-usage/MaterialUsageEditor.tsx",
      "src/modules/material-usage/MaterialUsageHistory.tsx",
      "src/modules/material-usage/MaterialUsageWorkspace.tsx",
      "src/modules/material-usage/actions.ts"
    ]
  },
  {
    "id": "workflow-catalog",
    "title": "Search Standard and Specialty material references",
    "externalRecordIds": [
      "catalog-search-and-annotations"
    ],
    "modules": [
      "catalog"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [],
    "terms": "catalog standard specialty system materials material manufacturer vendor size search reference notes inventory",
    "requiredTerms": [
      [
        "catalog"
      ],
      [
        "search",
        "find",
        "standard",
        "specialty"
      ]
    ],
    "status": "deployed",
    "route": "/catalog",
    "path": "Toolbox → Resources → Catalog",
    "guidance": "Open Toolbox → Resources → Catalog. Choose Standard Materials or System / Specialty, then search by material, vendor, size or system terms. Results load on demand after a search. Select a result for its details and reference notes. Specialty details are read-only on this page. Catalog references do not represent current Inventory quantities, and the Purchasing Vendor Catalog is a separate reference workflow.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I search the material Catalog?"
    ],
    "sourceFiles": [
      "src/app/catalog/page.tsx",
      "src/components/BusinessWriteControls.tsx",
      "src/components/ToolboxLauncher.tsx",
      "src/lib/rbac.ts"
    ]
  },
  {
    "id": "workflow-transmittal",
    "title": "Compose and issue a Letter of Transmittal",
    "externalRecordIds": [
      "transmittals-context",
      "transmittals-issue"
    ],
    "modules": [
      "transmittals"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "issueTransmittal",
      "previewOperationalDocuments"
    ],
    "terms": "letter transmittal transmittals lot create generate issue issued preview pdf history retry job standalone number sender recipient delivery",
    "requiredTerms": [
      [
        "transmittal",
        "transmittals"
      ],
      [
        "create",
        "issue",
        "generate",
        "retry"
      ]
    ],
    "status": "deployed",
    "route": "/transmittals",
    "path": "Toolbox → Tools → Letter of Transmittal → Job-linked / Standalone",
    "guidance": "Open Letter of Transmittal from Toolbox → Tools. Choose Job-linked and select the canonical Job, or Standalone / one-off for an explicitly unlinked document. A new Job-linked LoT requires a usable Job number; standalone numbering does not create a Production Job. Complete date, recipient, delivery and type, item rows, purpose or comments and sender. Choose Preview PDF to review the values, then Generate & Download and confirm the immutable Letter of Transmittal. Use History to open the existing PDF or retry its generation. A PDF failure retains the issued snapshot and number; do not issue another number merely to retry. The PDF is not automatically added to Job Files.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I create a Letter of Transmittal?"
    ],
    "sourceFiles": [
      "docs/workflows/LETTER_OF_TRANSMITTAL.md",
      "src/components/ToolboxLauncher.tsx",
      "src/modules/transmittals/JobTransmittalPanel.tsx",
      "src/modules/transmittals/TransmittalWorkspace.tsx",
      "src/modules/transmittals/mutations.ts",
      "supabase/functions/generate-job-transmittal-pdf/index.ts",
      "src/modules/transmittals/TransmittalWorkspace.tsx"
    ]
  },
  {
    "id": "workflow-sample-label",
    "title": "Print a Color Plate label with explicit access",
    "externalRecordIds": [
      "samples-labels"
    ],
    "modules": [
      "samples"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "sample_labels.generate"
    ],
    "terms": "sample samples color plate label labels print printing pdf wording approved draft popup",
    "requiredTerms": [
      [
        "sample",
        "samples",
        "plate"
      ],
      [
        "label",
        "labels"
      ]
    ],
    "status": "deployed",
    "route": "/samples",
    "path": "Sample editor → PRINT COLOR PLATE LABEL",
    "guidance": "Color Plate label generation requires operational access and the separate Color Plate Labels grant. Open the Sample and choose PRINT COLOR PLATE LABEL. Review the label wording, resolve required fields, then print through the browser dialog or download the PDF. Without an approval date, the output is marked DRAFT. Changes affect the current label wording; reopening starts from the Sample again. If pop-up blocking prevents Print, use the PDF. Browser output does not establish physical-printer acceptance.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I print a Sample Color Plate label?"
    ],
    "sourceFiles": [
      "src/lib/rbac.ts",
      "src/modules/samples/ColorPlateLabelEditor.tsx"
    ]
  },
  {
    "id": "workflow-sample-versions",
    "title": "Save reusable formula checkpoints and previews",
    "externalRecordIds": [
      "samples-versions"
    ],
    "modules": [
      "samples"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "sample samples formula formulation checkpoint checkpoints version versions restore saved working sheet preview current draft",
    "requiredTerms": [
      [
        "sample",
        "samples"
      ],
      [
        "checkpoint",
        "checkpoints",
        "version",
        "versions"
      ]
    ],
    "status": "deployed",
    "route": "/samples",
    "path": "Sample editor → Formula checkpoints and previews → Save Version / Use as Current Draft",
    "guidance": "Open the Sample and expand Formula checkpoints and previews. Add an optional note and choose Save Version; this saves the current draft before creating its reusable checkpoint. Use Preview current Sample or Preview checkpoint for a Working Sheet. To reuse a checkpoint, choose Use as Current Draft and confirm. Saved versions and newer checkpoints remain unchanged. A draft-save failure prevents creating the checkpoint. Working Sheet validation may block output; a Working Sheet does not issue a Sample Work Order.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I save a Sample formula checkpoint?"
    ],
    "sourceFiles": [
      "src/modules/samples/SampleVersionHistory.tsx",
      "src/modules/samples/queries.ts"
    ]
  },
  {
    "id": "workflow-sample-pour",
    "title": "Suggest and apply a Working Pour layout",
    "externalRecordIds": [
      "samples-pour-planning"
    ],
    "modules": [
      "samples"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "sample samples pour working suggest suggestion size planner layout dimensions geometry calculate apply thickness",
    "requiredTerms": [
      [
        "sample",
        "samples"
      ],
      [
        "pour",
        "layout"
      ]
    ],
    "status": "deployed",
    "route": "/samples",
    "path": "Sample editor → Prepare Sample → Suggest Pour Size",
    "guidance": "In Prepare Sample, choose Suggest Pour Size after entering finished geometry and Working Pour inputs. Choose maximum sizes or fixed columns, whether dimensions may rotate or change, and any edge or separation allowances. Calculate, review a proposed layout and its quantities, then apply one layout to the unsaved Working Pour. Applying changes only the current Working Pour dimensions; save the Sample to retain changes. Recalculate after input changes. The theoretical grid is not a shop-approved mold, and manual shop instructions remain unchanged.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I suggest a Working Pour size for a Sample?"
    ],
    "sourceFiles": [
      "src/modules/samples/SamplePourPlanner.tsx"
    ]
  },
  {
    "id": "workflow-task-groups",
    "title": "Organize tasks using personal Task Groups",
    "externalRecordIds": [
      "tasks-groups"
    ],
    "modules": [
      "my-work"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "my work task tasks group groups personal color colours organize organise membership name",
    "requiredTerms": [
      [
        "task",
        "tasks"
      ],
      [
        "group",
        "groups"
      ]
    ],
    "status": "deployed",
    "route": "/my-work",
    "path": "My Work → Task Groups; task Quick actions → Task Group",
    "guidance": "In My Work, create a Task Group with a name and color. Assign a task through its Quick actions or details. Groups and colors are personal: each participant organizes a Shared Task independently. A task belongs to one personal group, and its group color overrides your stored task color. A Task Group does not create a Messaging group or add participants. If you remove a group after confirmation, its tasks remain intact and lose that group membership.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I organize My Work tasks into groups?"
    ],
    "sourceFiles": [
      "src/modules/my-work/MyWorkPage.tsx",
      "supabase/migrations/20260902_004_my_work_task_groups.sql"
    ]
  },
  {
    "id": "workflow-task-files",
    "title": "Retain private task attachments and recover failed uploads",
    "externalRecordIds": [
      "tasks-attachments"
    ],
    "modules": [
      "my-work"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "my work task tasks attachments attachment files file upload add open retry private",
    "requiredTerms": [
      [
        "task",
        "tasks"
      ],
      [
        "attachment",
        "attachments",
        "files",
        "upload"
      ]
    ],
    "status": "deployed",
    "route": "/my-work",
    "path": "My Work → task composer or details → Add attachments",
    "guidance": "Add attachments while creating or editing a My Work task, then save the task association. Each file may be up to 25 MB. Open retained files from task details. Attachments remain private to authorized task participants; administrative cleanup authority does not grant routine reading access. A task may save successfully while an attachment fails. Retry the attachment on that existing task instead of creating the task again. Attachment removal is limited to eligible users and does not grant access to other employees’ private files.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I add attachments to a My Work task?"
    ],
    "sourceFiles": [
      "src/modules/my-work/MyWorkPage.tsx",
      "src/modules/my-work/queries.ts",
      "supabase/migrations/20260831_015_my_work_task_attachments.sql"
    ]
  },
  {
    "id": "workflow-task-effort",
    "title": "Estimate task effort and review personal Workload",
    "externalRecordIds": [
      "tasks-effort-workload"
    ],
    "modules": [
      "my-work"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData"
    ],
    "terms": "my work task tasks estimated estimate effort time workload minutes unestimated assigned delegated completion progress",
    "requiredTerms": [
      [
        "task",
        "tasks"
      ],
      [
        "estimated",
        "estimate",
        "effort",
        "workload"
      ]
    ],
    "status": "deployed",
    "route": "/my-work",
    "path": "My Work → task options / details → Estimated time; Workload",
    "guidance": "Set optional Estimated time while creating or editing a task and save the change. Expand Workload to review assigned-to-you counts and estimated effort progress. Review Assigned by me separately for delegated open work. Estimated time is expected effort, not logged labor. Unestimated tasks are counted separately rather than treated as zero effort. Workload uses the current view’s scope; Today includes its open seven-day and overdue set. Personal completion compares completed estimated effort with total personal estimated effort.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I estimate task effort and review Workload?"
    ],
    "sourceFiles": [
      "src/modules/my-work/MyWorkPage.tsx",
      "supabase/migrations/20260831_021_my_work_task_estimated_time.sql"
    ]
  },
  {
    "id": "workflow-job-archive",
    "title": "Archive or restore eligible Production Jobs",
    "externalRecordIds": [
      "production-archive-and-restore"
    ],
    "modules": [
      "production"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "writeBusinessData",
      "archiveProductionJob"
    ],
    "terms": "production job jobs archive archived restore finished shipped complete cancelled history active rework",
    "requiredTerms": [
      [
        "job",
        "jobs"
      ],
      [
        "archive",
        "archived",
        "restore"
      ]
    ],
    "status": "deployed",
    "route": "/",
    "path": "Production → Job Inspector → Details → Archive Job / Restore job",
    "guidance": "Open the Job Inspector’s Details. A Job can be archived when its status is Complete, Shipped or Cancelled and no Rework cycle remains active. Choose Archive Job and confirm. The Job leaves ordinary active views, while its existing identity, labor, material reports and files remain. To restore it, include archived work in Production or use Monthly Snapshot, open the Job and choose Restore job. Finish or cancel active Rework before archiving. Archiving is distinct from permanent deletion.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I archive or restore a Production Job?"
    ],
    "sourceFiles": [
      "src/lib/rbac.ts",
      "src/modules/production/components/MonthlySnapshot.tsx",
      "src/modules/production/components/ProductionJobInspector.tsx",
      "src/modules/production/jobs.ts"
    ]
  },
  {
    "id": "workflow-monthly-snapshot",
    "title": "Review Production Monthly Snapshot",
    "externalRecordIds": [
      "production-monthly-snapshot"
    ],
    "modules": [
      "production"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [],
    "terms": "production monthly snapshot month metrics labor workers tasks material usage inventory history archived period",
    "requiredTerms": [
      [
        "monthly",
        "snapshot"
      ],
      [
        "review",
        "view",
        "open",
        "metrics"
      ]
    ],
    "status": "deployed",
    "route": "/",
    "path": "Production → Monthly Snapshot",
    "guidance": "Choose Monthly Snapshot in Production to review period metrics, current exceptions and Shipped & Archived Jobs. It combines status-transition events, reported labor, dated Material Usage and Inventory transactions or receivals. Period facts and current operational state are labeled separately. Open the underlying Job or Production Reporting record to investigate a result. Counts cannot replace missing historical events, and material metrics come from reports rather than the Job’s current Material Status.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I review the Production Monthly Snapshot?"
    ],
    "sourceFiles": [
      "src/modules/production/ProductionWorkspace.tsx",
      "src/modules/production/components/MonthlySnapshot.tsx",
      "src/modules/production/snapshot.ts"
    ]
  },
  {
    "id": "workflow-manpower-history",
    "title": "Understand Manpower history and analytics scope",
    "externalRecordIds": [
      "manpower-history-and-analytics"
    ],
    "modules": [
      "manpower"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [],
    "terms": "manpower reporting history analytics period date dates all complete search filter totals product category group groups labor history exhaustive",
    "requiredTerms": [
      [
        "manpower"
      ],
      [
        "history",
        "analytics",
        "exhaustive"
      ]
    ],
    "status": "deployed",
    "route": "/manpower-reporting",
    "path": "Manpower Reporting → analytics / expanded reporting groups",
    "guidance": "In Manpower Reporting, choose a period to review its labor analytics. Expanded reporting groups below retain their complete membership across all dates; group display and analytics period have different scopes. Search and Product Category filters change displayed rows and totals without changing saved data or ordering. Wait until all available history has loaded before treating search as exhaustive. Loading or error states require retry before relying on totals. Legacy Uncategorized labor stays visible in the Product Category distribution.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "Why does Manpower history differ from its analytics period?"
    ],
    "sourceFiles": [
      "src/modules/manpower/ManpowerAnalytics.tsx",
      "src/modules/manpower/ManpowerWorkspace.tsx",
      "src/modules/manpower/manpower.ts"
    ]
  },
  {
    "id": "workflow-message-edit",
    "title": "Edit your own delivered employee message",
    "externalRecordIds": [
      "messaging-reply-edit"
    ],
    "modules": [
      "messaging"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "messaging.write"
    ],
    "terms": "message messages messaging dm conversation group edit edited own sent delivered body save",
    "requiredTerms": [
      [
        "message",
        "messages",
        "messaging",
        "dm"
      ],
      [
        "edit",
        "edited"
      ]
    ],
    "status": "deployed",
    "route": "/my-work",
    "path": "Messaging → authorized conversation → your message actions → Edit message → Save",
    "guidance": "Open an authorized employee DM or group. On your own delivered message, open message actions and choose Edit message. Change the nonempty body and choose Save. The message shows Edited without creating a duplicate. System messages do not offer ordinary employee editing. Removed group participants cannot edit former group content. Editing changes neither participants nor the conversation’s privacy rules.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I edit my own sent message?"
    ],
    "sourceFiles": [
      "docs/project-memory/2026-10-22-messaging-groups-replies-candidate.md",
      "src/modules/my-work/InboxDialog.tsx",
      "supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql",
      "supabase/migrations/20261022120000_messaging_groups_replies.sql"
    ]
  },
  {
    "id": "workflow-message-drafts",
    "title": "Recover browser-local employee message text drafts",
    "externalRecordIds": [
      "messaging-drafts"
    ],
    "modules": [
      "messaging"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [
      "messaging.write"
    ],
    "terms": "message messages messaging dm conversation browser local draft drafts unsent recover retained text attachment storage account",
    "requiredTerms": [
      [
        "message",
        "messages",
        "messaging",
        "dm"
      ],
      [
        "draft",
        "drafts",
        "unsent"
      ]
    ],
    "status": "deployed",
    "route": "/my-work",
    "path": "Messaging → authorized conversation → composer",
    "guidance": "Unsent employee message text is retained after a short delay and on page lifecycle changes. Return to the same authorized conversation in the same browser to recover it. Drafts are account-scoped and are not a cross-device transcript. Successful sending clears the captured draft while preserving newer unsent edits. Browser storage or privacy restrictions may prevent retention. Attachment file contents and signed links are not retained as text drafts. Switching accounts isolates draft state.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "Can I recover an unsent Messaging text draft?"
    ],
    "sourceFiles": [
      "src/lib/drafts/textDraft.ts",
      "src/lib/drafts/useTextDraft.ts",
      "src/modules/my-work/InboxDialog.tsx"
    ]
  },
  {
    "id": "workflow-appearance",
    "title": "Change personal appearance, display size and language",
    "externalRecordIds": [
      "settings-preferences"
    ],
    "modules": [
      "settings"
    ],
    "permission": "readOperationalData",
    "additionalPermissions": [],
    "terms": "settings appearance display size language light dark theme preference preferences change choose",
    "requiredTerms": [
      [
        "settings",
        "appearance",
        "display",
        "language"
      ],
      [
        "appearance",
        "display",
        "size",
        "language",
        "theme"
      ]
    ],
    "status": "deployed",
    "route": "/settings",
    "path": "Account menu → Settings → Appearance / Display Size / Language",
    "guidance": "Open Settings from the account menu. Choose Appearance, Display Size or Language and observe the interface update. Account preferences report loading or saving errors; the page remains usable with defaults if needed. Translation availability does not mean every interface string is translated. These are personal preferences. Settings links to Vendors and Workers open their owning Purchasing and Manpower modules.",
    "source": "TenOps verified workflow guide",
    "evidence": "docs/project-memory/2026-10-27-intake-graduation-material-intelligence.md#executed-intake-release--october-27-2026",
    "examples": [
      "How do I change appearance in Settings?"
    ],
    "sourceFiles": [
      "src/app/settings/page.tsx",
      "src/lib/account-preferences.tsx",
      "src/lib/appearance.tsx"
    ]
  }
];
