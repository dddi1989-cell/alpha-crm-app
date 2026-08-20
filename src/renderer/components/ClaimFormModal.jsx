import React from 'react';
import { X, Printer, Download, Shield, FileText } from 'lucide-react';
import { api } from '../utils/api';

export default function ClaimFormModal({ company, onClose }) {
  if (!company) return null;

  const handleDownload = async () => {
    try {
      await api.claims.downloadForm(company);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0f172a] text-white border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-lg">
              [{company.name}] 공식 보험금 청구서 서식 미리보기
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>바로 인쇄하기</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>파일로 다운로드</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Claim Form Document Body */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-slate-900 print-area">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              [{company.name}] 보험금 청구서 및 개인정보 동의서
            </h1>
          </div>

          {/* Info Box */}
          <div className="bg-slate-100 border border-slate-300 p-4 rounded-xl mb-6 space-y-1 text-sm">
            <p><strong>보험사명:</strong> {company.name} ({company.type})</p>
            <p>
              <strong>보험금 청구 접수 FAX:</strong>{' '}
              <span className="text-amber-600 font-bold font-mono text-base">{company.fax}</span>
            </p>
            <p><strong>고객센터 (콜센터):</strong> <span className="font-mono">{company.tel}</span></p>
          </div>

          {/* Section 1 */}
          <div className="mt-6 mb-2 font-bold text-base text-slate-900 border-l-4 border-blue-600 pl-2">
            1. 피보험자 / 청구인 정보
          </div>
          <table className="w-full border-collapse border border-slate-400 text-xs mb-6">
            <tbody>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">성명 (피보험자)</th>
                <td className="border border-slate-400 p-2 w-1/4"></td>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">주민등록번호</th>
                <td className="border border-slate-400 p-2 w-1/4"> - </td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">휴대폰 번호</th>
                <td className="border border-slate-400 p-2"></td>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">이메일 주소</th>
                <td className="border border-slate-400 p-2"></td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">청구인과의 관계</th>
                <td colSpan={3} className="border border-slate-400 p-2">
                  [ ] 본인 &nbsp;&nbsp;&nbsp; [ ] 배우자 &nbsp;&nbsp;&nbsp; [ ] 자녀 &nbsp;&nbsp;&nbsp; [ ] 기타( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )
                </td>
              </tr>
            </tbody>
          </table>

          {/* Section 2 */}
          <div className="mt-6 mb-2 font-bold text-base text-slate-900 border-l-4 border-blue-600 pl-2">
            2. 사고 / 질병 내용
          </div>
          <table className="w-full border-collapse border border-slate-400 text-xs mb-6">
            <tbody>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">사고/진단 일시</th>
                <td className="border border-slate-400 p-2 w-1/4">202 &nbsp;년 &nbsp;&nbsp;월 &nbsp;&nbsp;일</td>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">청구 구분</th>
                <td className="border border-slate-400 p-2 w-1/4">[ ] 실손 &nbsp; [ ] 수술 &nbsp; [ ] 입원 &nbsp; [ ] 진단</td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">진단명 / 질병명</th>
                <td colSpan={3} className="border border-slate-400 p-2"></td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">사고 및 경위 상세</th>
                <td colSpan={3} className="border border-slate-400 p-2 h-16"></td>
              </tr>
            </tbody>
          </table>

          {/* Section 3 */}
          <div className="mt-6 mb-2 font-bold text-base text-slate-900 border-l-4 border-blue-600 pl-2">
            3. 보험금 수령 계좌 정보
          </div>
          <table className="w-full border-collapse border border-slate-400 text-xs mb-6">
            <tbody>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">입금 은행</th>
                <td className="border border-slate-400 p-2 w-1/4"></td>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left w-1/4">예금주 성명</th>
                <td className="border border-slate-400 p-2 w-1/4"></td>
              </tr>
              <tr>
                <th className="border border-slate-400 bg-slate-200 p-2 text-left">계좌 번호</th>
                <td colSpan={3} className="border border-slate-400 p-2"></td>
              </tr>
            </tbody>
          </table>

          {/* Section 4 */}
          <div className="mt-6 mb-2 font-bold text-base text-slate-900 border-l-4 border-blue-600 pl-2">
            4. 개인(신용)정보 수집·이용 및 제공 동의
          </div>
          <div className="border border-slate-300 p-4 bg-slate-50 text-xs rounded-lg space-y-2 mb-6">
            <p>
              본인은 {company.name}에 보험금 청구 및 심사를 목적으로 개인(신용)정보를 수집·이용 및 제공하는 것에 동의합니다.
            </p>
            <p>동의일자: 202 &nbsp;&nbsp;년 &nbsp;&nbsp;&nbsp;&nbsp;월 &nbsp;&nbsp;&nbsp;&nbsp;일</p>
            <p className="pt-2 font-bold text-slate-900">
              청구인 (서명/인): __________________________________________________
            </p>
          </div>

          <div className="text-center text-xs text-slate-500 border-t border-slate-300 pt-4">
            위 청구서를 작성하신 후 팩스(FAX: <strong className="text-slate-800">{company.fax}</strong>)로 접수하시거나 고객센터({company.tel})로 문의 바랍니다.
          </div>
        </div>
      </div>
    </div>
  );
}
