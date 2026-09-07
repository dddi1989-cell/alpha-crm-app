/**
 * NTS Medical & Indemnity PDF Parser Module
 * 국세청 연말정산 간소화 PDF 의료비/실손보험금 자동 파서
 */

export async function parseNtsMedicalPdf(fileOrBuffer) {
  return new Promise((resolve) => {
    // Simulated high-fidelity extraction of NTS PDF structure
    setTimeout(() => {
      resolve({
        success: true,
        clientName: '이서진',
        clientPhone: '010-3344-5566',
        clientBirth: '1985-11-20',
        targetYear: 2025,
        totalExpenseAmount: 5120000,
        totalExpenseCount: 32,
        totalIndemnityAmount: 1650000,
        totalIndemnityCount: 5,
        unclaimedEstimatedAmount: 3470000,
        claimRatioPercent: 32.2,
        expensesByCategory: {
          hospital: 4100000,
          pharmacy: 720000,
          dental: 200000,
          optical: 100000
        },
        expenseList: [
          { id: 101, date: '2025-01-10', orgName: '강남세브란스병원', category: '상급종합병원/외래', amount: 890000, bizNo: '120-82-01928', isClaimed: true, matchedClaimId: 'PDF-CLM-01' },
          { id: 102, date: '2025-02-15', orgName: '아산참내과의원', category: '내과/대장내시경(용종절제)', amount: 780000, bizNo: '211-81-33445', isClaimed: false, matchedClaimId: null, note: '대장용종절제술 시술비 미청구' },
          { id: 103, date: '2025-03-20', orgName: '바른마디정형외과의원', category: '정형외과/도수치료', amount: 650000, bizNo: '134-86-55667', isClaimed: true, matchedClaimId: 'PDF-CLM-02' },
          { id: 104, date: '2025-04-12', orgName: '연세맑은이비인후과의원', category: '이비인후과', amount: 48000, bizNo: '109-88-11223', isClaimed: false, matchedClaimId: null },
          { id: 105, date: '2025-05-18', orgName: '서울마취통증의학과의원', category: '통증의학과/체외충격파', amount: 420000, bizNo: '115-86-77889', isClaimed: false, matchedClaimId: null, note: '어깨 체외충격파치료 미청구' },
          { id: 106, date: '2025-06-25', orgName: '고려대학교안암병원', category: '상급종합병원/정밀검사', amount: 950000, bizNo: '209-82-00112', isClaimed: false, matchedClaimId: null, note: '뇌정밀 MRI 검사비 미청구' },
          { id: 107, date: '2025-08-14', orgName: '온누리약국', category: '처방조제약', amount: 112000, bizNo: '124-11-88990', isClaimed: false, matchedClaimId: null },
          { id: 108, date: '2025-10-05', orgName: '연세치과의원', category: '치과/보철치료', amount: 200000, bizNo: '107-81-22334', isClaimed: false, matchedClaimId: null },
          { id: 109, date: '2025-11-22', orgName: '자생한방병원', category: '한방병원/침구치료', amount: 320000, bizNo: '114-82-44556', isClaimed: false, matchedClaimId: null },
          { id: 110, date: '2025-12-19', orgName: '강남연세피부과의원', category: '피부과/피부양성종양적출', amount: 750000, bizNo: '120-86-99001', isClaimed: false, matchedClaimId: null, note: '피부 양성종양(피지낭종) 적출수술비 미청구' }
        ],
        indemnityList: [
          { id: 'PDF-CLM-01', date: '2025-01-28', companyName: '메트라이프생명', claimType: '실손의료비(입통원)', amount: 780000, regNo: '2025-ML-88190', insuredPerson: '이서진' },
          { id: 'PDF-CLM-02', date: '2025-04-05', companyName: '삼성화재', claimType: '실손의료비(도수치료)', amount: 520000, regNo: '2025-SF-11920', insuredPerson: '이서진' },
          { id: 'PDF-CLM-03', date: '2025-07-10', companyName: '현대해상', claimType: '실손의료비(통원)', amount: 150000, regNo: '2025-HD-00214', insuredPerson: '이서진' },
          { id: 'PDF-CLM-04', date: '2025-09-18', companyName: 'DB손해보험', claimType: '실손의료비(약제비)', amount: 80000, regNo: '2025-DB-55610', insuredPerson: '이서진' },
          { id: 'PDF-CLM-05', date: '2025-11-30', companyName: '삼성화재', claimType: '실손의료비(통원)', amount: 120000, regNo: '2025-SF-99182', insuredPerson: '이서진' }
        ],
        unclaimedOpportunities: [
          {
            id: 'PDF-OPP-01',
            priority: 'HIGH',
            title: '고려대안암병원 뇌정밀 MRI 검사비',
            date: '2025-06-25',
            hospitalName: '고려대학교안암병원',
            expenseAmount: 950000,
            estimatedClaimAmount: 810000,
            suggestedAction: '상급종합병원 비급여 MRI 특약 전액 청구 (최대 80%~90% 보상)',
            requiredDocs: ['진료비 영수증', '진료비 세부내역서', '의사 판독소견서']
          },
          {
            id: 'PDF-OPP-02',
            priority: 'HIGH',
            title: '아산참내과 대장내시경 용종절제술 시술비',
            date: '2025-02-15',
            hospitalName: '아산참내과의원',
            expenseAmount: 780000,
            estimatedClaimAmount: 680000,
            suggestedAction: '실손의료비 + 질병수술비 특약 동시 청구 가능 (중복 수령 가능)',
            requiredDocs: ['진료비 영수증', '진료비 세부내역서', '조직검사결과지']
          },
          {
            id: 'PDF-OPP-03',
            priority: 'HIGH',
            title: '강남연세피부과 양성종양(피지낭종) 적출수술비',
            date: '2025-12-19',
            hospitalName: '강남연세피부과의원',
            expenseAmount: 750000,
            estimatedClaimAmount: 650000,
            suggestedAction: '피부 양성종양 절제 수술비 및 통원 실손 청구',
            requiredDocs: ['진료비 영수증', '진료비 세부내역서', '수술확인서 (조직검사지)']
          },
          {
            id: 'PDF-OPP-04',
            priority: 'MEDIUM',
            title: '서울마취통증의학과 어깨 체외충격파치료',
            date: '2025-05-18',
            hospitalName: '서울마취통증의학과의원',
            expenseAmount: 420000,
            estimatedClaimAmount: 340000,
            suggestedAction: '정형외과/통증의학과 비급여 물리치료 통원 실손 청구',
            requiredDocs: ['진료비 영수증', '진료비 세부내역서']
          }
        ]
      });
    }, 1200);
  });
}
