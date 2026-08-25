import React, { useState } from 'react';
import { FileText, Search, Copy, Check, Download, Phone, Printer, Filter, Shield, Eye, ExternalLink, Globe, BookOpen, HelpCircle } from 'lucide-react';
import { api, isElectron } from '../utils/api';
import ClaimFormModal from './ClaimFormModal';

const INSURANCE_COMPANIES = [
  // 생명보험사
  {
    id: 'abl_life',
    name: 'ABL생명',
    type: '생명보험',
    tel: '1588-6500',
    url: 'https://cyber.abllife.co.kr/',
    termsUrl: 'https://www.abllife.co.kr/st/pban/prdtPban/whlPrdt/whlPrdt1/whlPrdt11?page=index',
    fax: '가상번호 부여'
  },
  {
    id: 'db_life',
    name: 'DB생명',
    type: '생명보험',
    tel: '1588-3131',
    url: 'https://www.idblife.com/',
    termsUrl: 'https://www.idblife.com/notice/product/sale',
    fax: '0505-129-3134'
  },
  {
    id: 'im_life',
    name: 'IM라이프',
    type: '생명보험',
    tel: '1588-4770',
    url: 'https://www.imlifeins.co.kr/',
    termsUrl: 'https://www.imlifeins.co.kr/BA/BA_A020.do',
    fax: '콜센터 접수 후 0505-083-5420'
  },
  {
    id: 'kb_life',
    name: 'KB라이프',
    type: '생명보험',
    tel: '1588-3374',
    url: 'https://www.kblife.co.kr/',
    termsUrl: 'https://www.kblife.co.kr/customer-common/productList.do',
    fax: '02-6220-9912'
  },
  {
    id: 'kdb_life',
    name: 'KDB생명',
    type: '생명보험',
    tel: '1588-4040',
    url: 'https://www.kdblife.co.kr/',
    termsUrl: 'https://www.kdblife.co.kr/ajax.do?scrId=HDLMA002M02P',
    fax: '콜센터 접수 후 02-2669-7939'
  },
  {
    id: 'kyobo_life',
    name: '교보생명',
    type: '생명보험',
    tel: '1588-1001',
    url: 'https://www.kyobo.com/',
    termsUrl: 'https://www.kyobo.com/dgt/web/product-official/all-product/search',
    fax: '가상번호 부여'
  },
  {
    id: 'nh_life',
    name: '농협생명',
    type: '생명보험',
    tel: '1544-4000',
    url: 'https://www.nhlife.co.kr/',
    termsUrl: 'https://www.nhlife.co.kr/ho/on/HOON0004M00.nhl',
    fax: '02-6971-6040'
  },
  {
    id: 'dongyang_life',
    name: '동양생명',
    type: '생명보험',
    tel: '1577-1004',
    url: 'https://www.myangel.co.kr/',
    termsUrl: 'https://pbano.myangel.co.kr/paging/WE_AC_WEPAAP020100L',
    fax: '2026년 8월부터 종료'
  },
  {
    id: 'lina_life',
    name: '라이나생명',
    type: '생명보험',
    tel: '1588-0058',
    url: 'https://www.lina.co.kr/',
    termsUrl: 'https://www.lina.co.kr/disclosure/product-public-announcement/product-on-sales?key=0',
    fax: '02-6944-1200'
  },
  {
    id: 'metlife',
    name: '메트라이프',
    type: '생명보험',
    tel: '1588-9600',
    url: 'https://cyber.metlife.co.kr/',
    termsUrl: 'https://brand.metlife.co.kr/pn/mcvrgProd/retrieveMcvrgProdMain.do',
    fax: '가상번호 부여'
  },
  {
    id: 'mirae_asset_life',
    name: '미래에셋생명',
    type: '생명보험',
    tel: '1588-0220',
    url: 'https://life.miraeasset.com/',
    termsUrl: 'https://life.miraeasset.com/micro/disclosure/product/PC-HO-080301-000000.do',
    fax: '가상번호 부여'
  },
  {
    id: 'samsung_life',
    name: '삼성생명',
    type: '생명보험',
    tel: '1588-3114',
    url: 'https://www.samsunglife.com/',
    termsUrl: 'https://www.samsunglife.com/individual/products/disclosure/sales/PDO-PRPRI010110M',
    fax: '1577-4118로 문의'
  },
  {
    id: 'shinhan_life',
    name: '신한라이프',
    type: '생명보험',
    tel: '1588-5580',
    url: 'https://www.shinhanlife.co.kr/',
    termsUrl: 'https://www.shinhanlife.co.kr/hp/cdhi0030.do',
    fax: '가상번호 부여'
  },
  {
    id: 'chubb_life',
    name: '처브라이프',
    type: '생명보험',
    tel: '1599-4600',
    url: 'https://www.chubblife.co.kr/',
    termsUrl: 'https://www.chubblife.co.kr/front/official/sale/listSale.do',
    fax: '02-3480-7801'
  },
  {
    id: 'aia_life',
    name: 'AIA생명',
    type: '생명보험',
    tel: '1588-9898',
    url: 'https://www.aia.co.kr/',
    termsUrl: 'https://mypage.aia.co.kr/AIAHomepage/disclosure/our-products/selling/individual.do',
    fax: '가상번호 부여'
  },
  {
    id: 'epost_life',
    name: '우체국보험',
    type: '생명보험',
    tel: '1599-0100',
    url: 'https://www.epostlife.go.kr/',
    termsUrl: 'https://www.epostlife.go.kr/ASISDM00AT.do',
    fax: '가상번호 부여'
  },
  {
    id: 'cardif_life',
    name: '카디프생명',
    type: '생명보험',
    tel: '1688-1118',
    url: 'https://www.cardif.co.kr/',
    termsUrl: 'https://www.cardif.co.kr/disclosure/papag101.do',
    fax: '02-3788-8939'
  },
  {
    id: 'fubon_hyundai',
    name: '푸본현대생명',
    type: '생명보험',
    tel: '1577-3311',
    url: 'https://www.fubonhyundai.com/',
    termsUrl: 'https://www.fubonhyundai.com/#CUSI150102010101',
    fax: '0505-106-0311'
  },
  {
    id: 'hana_life',
    name: '하나생명',
    type: '생명보험',
    tel: '1577-1112',
    url: 'https://hanalife.co.kr/',
    termsUrl: 'https://hanalife.co.kr/anm/product/allProduct.do?status=on',
    fax: '가상번호 부여'
  },
  {
    id: 'hanwha_life',
    name: '한화생명',
    type: '생명보험',
    tel: '1588-6363',
    url: 'https://www.hanwhalife.com/',
    termsUrl: null,
    termsGuide: '홈페이지>공시실>상품공시',
    fax: '가상번호 부여'
  },
  {
    id: 'heungkuk_life',
    name: '흥국생명',
    type: '생명보험',
    tel: '1588-2288',
    url: 'https://www.heungkuklife.co.kr/',
    termsUrl: 'https://www.heungkuklife.co.kr/front/public/saleProduct.do?searchFlgSale=Y',
    fax: '가상번호 부여'
  },

  // 손해보험사
  {
    id: 'aig_insurance',
    name: 'AIG손해보험',
    type: '손해보험',
    tel: '1544-2792',
    url: 'https://www.aig.co.kr/',
    termsUrl: 'https://www.aig.co.kr/wo/dpwot001.html?menuId=MS702',
    fax: '02-2011-4607'
  },
  {
    id: 'db_promy',
    name: 'DB손해보험',
    type: '손해보험',
    tel: '1588-0100',
    url: 'https://www.idbins.com/',
    termsUrl: 'https://www.idbins.com/FWMAIV1534.do',
    fax: '0505-181-4862'
  },
  {
    id: 'kb_insurance',
    name: 'KB손해보험',
    type: '손해보험',
    tel: '1544-0114',
    url: 'https://www.kbinsure.co.kr/',
    termsUrl: 'https://www.kbinsure.co.kr/CG802030001.ec',
    fax: '0505-136-6500'
  },
  {
    id: 'mg_insurance',
    name: 'MG(예별)손해보험',
    type: '손해보험',
    tel: '1588-5959',
    url: 'https://www.yebyeol.co.kr/',
    termsUrl: 'https://www.yebyeol.co.kr/PB031210DM.scp?menuId=MN0803006',
    fax: '0505-088-1646'
  },
  {
    id: 'nh_fire',
    name: '농협손해보험',
    type: '손해보험',
    tel: '1644-9000',
    url: 'https://www.nhfire.co.kr/',
    termsUrl: 'https://www.nhfire.co.kr/announce/productAnnounce/retrieveInsuranceProductsAnnounce.nhfire',
    fax: '0505-060-7000'
  },
  {
    id: 'lina_fire',
    name: '라이나손해보험',
    type: '손해보험',
    tel: '1566-5800',
    url: 'https://www.chubb.com/',
    termsUrl: 'https://www.chubb.com/kr-kr/disclosure/product.html',
    fax: '02-2127-2308'
  },
  {
    id: 'lotte_insurance',
    name: '롯데손해보험',
    type: '손해보험',
    tel: '1588-3344',
    url: 'https://www.lotteins.co.kr/',
    termsUrl: 'http://www.lotteins.co.kr/web/C/D/H/cdh170.jsp',
    fax: '0507-333-9999'
  },
  {
    id: 'meritz_fire',
    name: '메리츠화재',
    type: '손해보험',
    tel: '1566-7711',
    url: 'https://www.meritzfire.com/',
    termsUrl: 'https://www.meritzfire.com/disclosure/product-announcement/product-list.do#!/',
    fax: '0505-021-3400'
  },
  {
    id: 'samsung_fire',
    name: '삼성화재',
    type: '손해보험',
    tel: '1588-5114',
    url: 'https://www.samsungfire.com/',
    termsUrl: 'https://www.samsungfire.com/vh/page/VH.HPIF0103.do',
    fax: '0505-162-0872'
  },
  {
    id: 'hana_insurance',
    name: '하나손해보험',
    type: '손해보험',
    tel: '1566-3000',
    url: 'https://www.hanainsure.co.kr/',
    termsUrl: 'https://www.hanainsure.co.kr/w/disclosure/product/saleProduct',
    fax: '0505-170-0765'
  },
  {
    id: 'hanwha_general',
    name: '한화손해보험',
    type: '손해보험',
    tel: '1566-8000',
    url: 'https://www.hwgeneralins.com/',
    termsUrl: 'https://www.hwgeneralins.com/notice/ir/product-ing01.do',
    fax: '고객센터접수'
  },
  {
    id: 'hyundai_marine',
    name: '현대해상',
    type: '손해보험',
    tel: '1588-5656',
    url: 'https://www.hi.co.kr/',
    termsUrl: 'https://www.hi.co.kr/serviceAction.do?view=bin/PA/03/HHPA03010M',
    fax: '0507-774-6060'
  },
  {
    id: 'heungkuk_fire',
    name: '흥국화재',
    type: '손해보험',
    tel: '1688-1688',
    url: 'https://www.heungkukfire.co.kr/',
    termsUrl: 'https://www.heungkukfire.co.kr/FRW/announce/insGoodsGongsiSale.do',
    fax: '0504-800-1300'
  }
];

export default function ClaimsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('전체');
  const [copiedFax, setCopiedFax] = useState(null);
  const [previewCompany, setPreviewCompany] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);

  const handleCopyFax = (fax, id) => {
    navigator.clipboard.writeText(fax);
    setCopiedFax(id);
    setTimeout(() => setCopiedFax(null), 2000);
  };

  const handleOpenUrl = (url) => {
    if (url) {
      api.system.openUrl(url);
    }
  };

  const handleDownloadForm = async (company) => {
    try {
      const res = await api.claims.downloadForm(company);
      if (res?.success) {
        setDownloadNotice(`[${company.name}] 첨부된 공식 청구서 PDF가 저장되고 열렸습니다.`);
        setTimeout(() => setDownloadNotice(null), 4000);
      }
    } catch (err) {
      console.error('Form download error:', err);
    }
  };

  const handleOpenDirectPdf = async (company) => {
    try {
      const res = await api.claims.openPdf(company);
      if (!res?.success) {
        setPreviewCompany(company);
      }
    } catch (err) {
      setPreviewCompany(company);
    }
  };

  const filteredCompanies = INSURANCE_COMPANIES.filter(c => {
    const matchesType = selectedType === '전체' || c.type === selectedType;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || (
      c.name.toLowerCase().includes(term) ||
      c.fax.includes(term) ||
      c.tel.includes(term)
    );
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
            보험사별 청구 FAX & 공식홈페이지 및 상품공시실 약관 ({INSURANCE_COMPANIES.length}개 보험사)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            국내 주요 보험사의 고객센터, 클릭 시 즉시 연결되는 공식 홈페이지, 상품공시실(약관) 및 청구 FAX 번호를 제공합니다.
          </p>
        </div>
      </div>

      {downloadNotice && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl flex items-center space-x-2 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{downloadNotice}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="보험사명, FAX 번호, 전화번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {['전체', '손해보험', '생명보험'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedType === type
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {type} ({INSURANCE_COMPANIES.filter(c => type === '전체' || c.type === type).length})
            </button>
          ))}
        </div>
      </div>

      {/* Insurance Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCompanies.map((company) => {
          const isSpecialFax = company.fax.includes('가상번호') || company.fax.includes('콜센터') || company.fax.includes('종료') || company.fax.includes('문의');
          return (
            <div
              key={company.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition-all space-y-4 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-base text-white">{company.name}</h3>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    company.type === '손해보험'
                      ? 'bg-blue-950/80 text-blue-400 border-blue-800/60'
                      : 'bg-purple-950/80 text-purple-400 border-purple-800/60'
                  }`}>
                    {company.type}
                  </span>
                </div>

                {/* FAX Details */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>청구 접수 FAX:</span>
                    </div>
                    <button
                      onClick={() => handleCopyFax(company.fax, company.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
                      title="FAX 번호 또는 안내 문구 복사"
                    >
                      {copiedFax === company.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">복사됨!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>복사</span>
                        </>
                      )}
                    </button>
                  </div>
                  <span className={`text-xs font-bold block tracking-wide ${
                    isSpecialFax ? 'text-emerald-400 font-sans' : 'text-amber-300 font-mono text-sm'
                  }`}>
                    {company.fax}
                  </span>
                </div>

                {/* Phone & Website Buttons */}
                <div className="space-y-2.5 px-1 text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>고객센터:</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200 font-mono">{company.tel}</span>
                      <a
                        href={`tel:${company.tel.replace(/[^0-9]/g, '')}`}
                        className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md font-bold text-[10px] hover:bg-emerald-900 transition-all flex items-center space-x-1"
                        title="전화 연결"
                      >
                        <Phone className="w-2.5 h-2.5" />
                        <span>통화</span>
                      </a>
                    </div>
                  </div>

                  {/* Official Website & Terms (약관보러가기) Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                    {/* 공식홈페이지 버튼 */}
                    <button
                      onClick={() => handleOpenUrl(company.url)}
                      className="py-2 px-2.5 bg-slate-800/90 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-400/60 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm active:scale-95 group/btn"
                      title={`${company.name} 공식 홈페이지 열기`}
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-400 group-hover/btn:rotate-12 transition-transform" />
                      <span>공식홈페이지</span>
                    </button>

                    {/* 약관보러가기 버튼 */}
                    {company.termsUrl ? (
                      <button
                        onClick={() => handleOpenUrl(company.termsUrl)}
                        className="py-2 px-2.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm active:scale-95 group/btn"
                        title={`${company.name} 상품공시실 및 약관 페이지 열기`}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                        <span>약관보러가기</span>
                      </button>
                    ) : (
                      <div className="relative group/terms flex">
                        <button
                          onClick={() => alert(`[${company.name}] 약관 확인 경로 안내:\n${company.termsGuide || '홈페이지>공시실>상품공시'}`)}
                          className="w-full py-2 px-2.5 bg-amber-950/30 hover:bg-amber-900/50 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/60 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-95"
                          title={company.termsGuide || '홈페이지>공시실>상품공시'}
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          <span>약관보러가기</span>
                        </button>
                        
                        {/* Hover Tooltip for Hanwha Life */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/terms:flex flex-col items-center z-30 pointer-events-none">
                          <div className="bg-slate-950 border border-amber-500/60 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center space-x-1">
                            <span>경로: {company.termsGuide || '홈페이지>공시실>상품공시'}</span>
                          </div>
                          <div className="w-2 h-2 bg-slate-950 border-r border-b border-amber-500/60 rotate-45 -mt-1"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PDF Action Buttons (Desktop Electron Only) */}
              {isElectron && (
                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOpenDirectPdf(company)}
                    className="py-2 px-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 border border-slate-700"
                    title="공식 PDF 서식 즉시 열기"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    <span>PDF 즉시 열기</span>
                  </button>
                  <button
                    onClick={() => handleDownloadForm(company)}
                    className="py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 group-hover:bg-indigo-600 group-hover:text-white"
                    title="공식 PDF 청구서 다운로드"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF 다운로드</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Claim Form Preview & Print Modal */}
      {previewCompany && (
        <ClaimFormModal
          company={previewCompany}
          onClose={() => setPreviewCompany(null)}
        />
      )}
    </div>
  );
}
