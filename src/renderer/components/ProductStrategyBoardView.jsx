import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Search, Plus, Download, Eye, Paperclip, Calendar, User, 
  Trash2, Edit, X, File, FileSpreadsheet, Image, AlertCircle, CheckCircle2, 
  ExternalLink, RefreshCw, Loader2, CloudUpload, LayoutGrid, List, 
  FileCheck, Sparkles, FolderDown, ArrowUpRight, BookOpen, Layers, Check,
  Maximize2
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';

export default function ProductStrategyBoardView() {
  const currentUser = useCrmStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.username === 'admin';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // View mode: 'gallery' (Default) | 'list'
  const [viewMode, setViewMode] = useState('gallery');

  // Detail Modal State
  const [selectedPost, setSelectedPost] = useState(null);
  const [postAttachments, setPostAttachments] = useState([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  // Write/Edit Modal State (Admin Only)
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '상품전략'
  });
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [deleteAttachmentIds, setDeleteAttachmentIds] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  const loadPosts = async () => {
    setLoading(true);
    try {
      const res = await api.board.getPosts({ search });
      if (res?.success) {
        setPosts(res.posts || []);
      }
    } catch (err) {
      console.error('loadPosts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [search]);

  // Open Detail Modal
  const handleOpenDetail = async (postSummary) => {
    try {
      const res = await api.board.getPostDetail(postSummary.id);
      if (res?.success) {
        setSelectedPost(res.post);
        setPostAttachments(res.attachments || []);
        setIsDetailModalOpen(true);
        setPosts(prev => prev.map(p => p.id === postSummary.id ? { ...p, views: (p.views || 0) + 1 } : p));
      } else {
        alert(res?.error || '게시글을 불러올 수 없습니다.');
      }
    } catch (err) {
      alert('게시글 조회 중 오류: ' + err.message);
    }
  };

  // Quick Open Attachment directly from card
  const handleQuickOpen = async (e, post) => {
    e.stopPropagation();
    if (!post.first_attachment_id) {
      handleOpenDetail(post);
      return;
    }
    setOpeningId(post.first_attachment_id);
    try {
      const res = await api.board.openAttachment(post.first_attachment_id);
      if (!res?.success) {
        alert(res?.error || '파일을 열 수 없습니다.');
      }
    } catch (err) {
      alert('열기 실패: ' + err.message);
    } finally {
      setOpeningId(null);
    }
  };

  // Quick Download Attachment directly from card
  const handleQuickDownload = async (e, post) => {
    e.stopPropagation();
    if (!post.first_attachment_id) {
      handleOpenDetail(post);
      return;
    }
    setDownloadingId(post.first_attachment_id);
    try {
      const res = await api.board.downloadAttachment(post.first_attachment_id);
      if (res?.success && res.savedPath) {
        alert('다운로드가 완료되었습니다:\n' + res.savedPath);
      } else if (res?.error && res.error !== '다운로드가 취소되었습니다.') {
        alert('다운로드 실패: ' + res.error);
      }
    } catch (err) {
      alert('다운로드 오류: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingPostId(null);
    setFormData({ title: '', content: '', category: '상품전략' });
    setExistingAttachments([]);
    setDeleteAttachmentIds([]);
    setNewAttachments([]);
    setFormError('');
    setUploadStatusMsg('');
    setIsWriteModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = async (postSummary) => {
    try {
      const res = await api.board.getPostDetail(postSummary.id);
      if (res?.success) {
        setEditingPostId(res.post.id);
        setFormData({
          title: res.post.title,
          content: res.post.content || '',
          category: res.post.category || '상품전략'
        });
        setExistingAttachments(res.attachments || []);
        setDeleteAttachmentIds([]);
        setNewAttachments([]);
        setFormError('');
        setUploadStatusMsg('');
        setIsWriteModalOpen(true);
      }
    } catch (err) {
      alert('수정 데이터 로드 실패: ' + err.message);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId) => {
    if (!confirm('정말로 이 게시글과 첨부파일을 삭제하시겠습니까? (복구 불가)')) return;
    try {
      const res = await api.board.deletePost({
        postId,
        currentUserId: currentUser?.id
      });
      if (res?.success) {
        alert('게시글이 삭제되었습니다.');
        loadPosts();
        if (selectedPost?.id === postId) {
          setIsDetailModalOpen(false);
        }
      } else {
        alert(res?.error || '삭제 실패');
      }
    } catch (err) {
      alert('삭제 중 오류: ' + err.message);
    }
  };

  // Select Local Files for Upload
  const handleSelectFiles = async () => {
    try {
      const res = await api.board.selectFiles();
      if (res?.success && res.files && res.files.length > 0) {
        const mapped = res.files.map(f => ({
          name: f.name,
          path: f.path,
          size: f.size,
          type: f.type || getExt(f.name)
        }));
        setNewAttachments(prev => [...prev, ...mapped]);
      }
    } catch (err) {
      alert('파일 선택 오류: ' + err.message);
    }
  };

  // Save Post (Create / Update)
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('제목을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setFormError('');
    setUploadStatusMsg('클라우드 저장소에 첨부파일을 동기화하고 있습니다...');

    try {
      let res;
      if (editingPostId) {
        res = await api.board.updatePost({
          postId: editingPostId,
          title: formData.title,
          content: formData.content,
          category: formData.category,
          newAttachments,
          deleteAttachmentIds,
          currentUserId: currentUser?.id
        });
      } else {
        res = await api.board.createPost({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          attachments: newAttachments,
          currentUserId: currentUser?.id
        });
      }

      if (res?.success) {
        setIsWriteModalOpen(false);
        loadPosts();
      } else {
        setFormError(res?.error || '게시글 저장에 실패했습니다.');
      }
    } catch (err) {
      setFormError('저장 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setSaving(false);
      setUploadStatusMsg('');
    }
  };

  // Download Attachment (Modal)
  const handleDownloadAttachment = async (attachmentId) => {
    setDownloadingId(attachmentId);
    try {
      const res = await api.board.downloadAttachment(attachmentId);
      if (res?.success && res.savedPath) {
        alert('다운로드가 완료되었습니다:\n' + res.savedPath);
      } else if (res?.error && res.error !== '다운로드가 취소되었습니다.') {
        alert('다운로드 실패: ' + res.error);
      }
    } catch (err) {
      alert('다운로드 오류: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Attachment (Modal)
  const handleOpenAttachment = async (attachmentId) => {
    setOpeningId(attachmentId);
    try {
      const res = await api.board.openAttachment(attachmentId);
      if (!res?.success) {
        alert(res?.error || '파일을 열 수 없습니다.');
      }
    } catch (err) {
      alert('열기 실패: ' + err.message);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="p-8 space-y-7 animate-fadeIn max-w-7xl mx-auto font-['Inter',sans-serif]">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight">
                  상품전략자료실
                </h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>PDF 실물 첫 장 갤러리</span>
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                본사 및 관리자가 등록한 상품 비교 분석표, 제안서 양식, 상품 브리핑 자료의 실제 1페이지를 미리보기로 열람할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Refresh, View Switcher, Admin Write */}
        <div className="flex items-center space-x-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('gallery')}
              className={'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ' + 
                (viewMode === 'gallery' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              title="PDF 실물 첫 장 썸네일 카드 갤러리 뷰"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>문서 갤러리</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ' + 
                (viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}
              title="목록 테이블 뷰"
            >
              <List className="w-3.5 h-3.5" />
              <span>목록형</span>
            </button>
          </div>

          <button
            onClick={loadPosts}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin text-indigo-400' : '')} />
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>신규 자료 등록 (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="자료 제목, 내용, 첨부파일명 검색..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <p className="text-xs text-slate-400 font-medium">
          총 <strong className="text-indigo-400 font-bold">{posts.length}</strong>건의 전략 자료가 등록되어 있습니다.
        </p>
      </div>

      {/* 3. MAIN CONTENT: Gallery Card View (Default) vs Table List View */}
      {viewMode === 'gallery' ? (
        /* ========================================================================= */
        /* GALLERY / PDF REAL 1ST PAGE THUMBNAIL CARD VIEW */
        /* ========================================================================= */
        <div>
          {loading && posts.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs text-slate-400">자료실 문서를 불러오는 중입니다...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-16 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-300">등록된 전략 자료가 없습니다.</p>
              <p className="text-xs text-slate-500">최고 관리자가 새로운 상품 비교 및 브리핑 문서를 등록하면 이곳에 카드 형태로 표시됩니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {posts.map((post) => {
                const dateStr = post.created_at ? post.created_at.split('T')[0] : '-';
                const hasAttachment = post.attachment_count > 0;
                const fileName = post.first_file_name || '첨부자료.pdf';
                const isOpening = openingId === post.first_attachment_id;
                const isDownloading = downloadingId === post.first_attachment_id;

                return (
                  <div
                    key={post.id}
                    onClick={() => handleOpenDetail(post)}
                    className="group bg-slate-900/90 hover:bg-slate-850/90 border border-slate-800/90 hover:border-indigo-500/60 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col cursor-pointer hover:-translate-y-1 relative"
                  >
                    {/* TOP PREVIEW / PDF REAL FIRST PAGE THUMBNAIL AREA */}
                    <div className="relative aspect-[3/4] bg-slate-950 flex flex-col justify-between overflow-hidden border-b border-slate-800/80 select-none">
                      {/* Real PDF 1st Page Image Thumbnail Component */}
                      <PdfFirstPagePreview 
                        attachmentId={post.first_attachment_id} 
                        fileName={fileName}
                        postTitle={post.title}
                        category={post.category}
                      />

                      {/* HOVER QUICK ACTION OVERLAY */}
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center p-4 space-y-2.5 z-10">
                        {hasAttachment && (
                          <button
                            onClick={(e) => handleQuickOpen(e, post)}
                            disabled={isOpening}
                            className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg transition-transform hover:scale-105 active:scale-95"
                          >
                            {isOpening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            <span>{isOpening ? '열람 중...' : '문서 즉시 열기'}</span>
                          </button>
                        )}
                        {hasAttachment && (
                          <button
                            onClick={(e) => handleQuickDownload(e, post)}
                            disabled={isDownloading}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 shadow transition-transform hover:scale-105 active:scale-95"
                          >
                            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-400" />}
                            <span>{isDownloading ? '저장 중...' : '내 PC 다운로드'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetail(post)}
                          className="w-full py-2 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          <span>상세 내용 보기</span>
                        </button>
                      </div>

                      {/* Admin Quick Edit/Delete buttons on hover */}
                      {isAdmin && (
                        <div 
                          className="absolute top-3 right-3 z-20 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenEditModal(post)}
                            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition-all"
                            title="게시글 수정"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-all"
                            title="게시글 삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* BOTTOM METADATA & TITLE AREA */}
                    <div className="p-4 flex flex-col justify-between flex-1 space-y-2.5 bg-slate-900/60">
                      <div className="space-y-1.5">
                        {/* Title with Icon */}
                        <div className="flex items-start space-x-2">
                          <div className="mt-0.5 shrink-0">
                            {getFileFormatIcon(fileName, 'w-4 h-4')}
                          </div>
                          <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h4>
                        </div>

                        {/* File Name info */}
                        {hasAttachment && (
                          <p className="text-[10px] text-slate-400 font-mono truncate pl-6">
                            {fileName}
                          </p>
                        )}
                      </div>

                      {/* Footer Metadata */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-purple-400 font-bold">Admin</span>
                          <span>·</span>
                          <span>{dateStr}</span>
                        </div>

                        {post.attachment_count > 1 ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-400 font-bold font-mono">
                            +{post.attachment_count}개 파일
                          </span>
                        ) : (
                          <span className="text-slate-600">조회 {post.views || 0}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* LIST / TABLE VIEW */
        /* ========================================================================= */
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold text-[11px]">
                  <th className="p-3.5 text-center w-14">번호</th>
                  <th className="p-3.5">제목</th>
                  <th className="p-3.5 text-center w-28">첨부파일</th>
                  <th className="p-3.5 text-center w-24">작성자</th>
                  <th className="p-3.5 text-center w-28">등록일</th>
                  <th className="p-3.5 text-center w-16">조회</th>
                  {isAdmin && <th className="p-3.5 text-right w-20">관리</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-12 text-center text-slate-500 font-medium">
                      등록된 자료가 없습니다.
                    </td>
                  </tr>
                ) : (
                  posts.map((post, idx) => {
                    const dateStr = post.created_at ? post.created_at.split('T')[0] : '-';
                    const fileName = post.first_file_name || '첨부자료.pdf';
                    return (
                      <tr 
                        key={post.id}
                        onClick={() => handleOpenDetail(post)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="p-3.5 text-center text-slate-500 font-mono font-bold">
                          {posts.length - idx}
                        </td>
                        <td className="p-3.5 font-bold text-white group-hover:text-indigo-400 transition-colors">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold shrink-0">
                              {post.category || '상품전략'}
                            </span>
                            <div className="flex items-center space-x-1.5 truncate">
                              {getFileFormatIcon(fileName, 'w-3.5 h-3.5 shrink-0')}
                              <span className="truncate max-w-md">{post.title}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          {post.attachment_count > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold text-[10px]">
                              <Paperclip className="w-3 h-3" />
                              <span>{post.attachment_count}개</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-bold">
                            👑 Admin
                          </span>
                        </td>
                        <td className="p-3.5 text-center text-slate-400 font-mono text-[11px]">
                          {dateStr}
                        </td>
                        <td className="p-3.5 text-center text-slate-500 font-mono text-[11px]">
                          {post.views || 0}
                        </td>
                        {isAdmin && (
                          <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleOpenEditModal(post)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                                title="게시글 수정"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                title="게시글 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DETAIL MODAL (모든 사용자 열람 및 첨부파일 다운로드/열기) */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/60">
              <div className="space-y-1.5 flex-1 pr-4">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-bold">
                    {selectedPost.category || '상품전략'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    등록일: {selectedPost.created_at ? selectedPost.created_at.split('T')[0] : '-'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    · 조회 {selectedPost.views || 0}
                  </span>
                </div>
                <h3 className="font-['Outfit',sans-serif] text-xl font-bold text-white tracking-tight">
                  {selectedPost.title}
                </h3>
                <div className="text-xs text-slate-400 flex items-center space-x-1">
                  <span>작성자:</span>
                  <strong className="text-purple-400 font-semibold">{selectedPost.author_name}</strong>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEditModal(selectedPost);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all flex items-center space-x-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>수정</span>
                  </button>
                )}
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
              {/* Content Text */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-normal min-h-[120px]">
                {selectedPost.content || '본문 설명이 없습니다.'}
              </div>

              {/* Attachments List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                  <span>공유 첨부파일 ({postAttachments.length}개)</span>
                </h4>

                {postAttachments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    첨부된 파일이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {postAttachments.map((att) => {
                      const isDownloading = downloadingId === att.id;
                      const isOpening = openingId === att.id;
                      const sizeStr = formatBytes(att.file_size);

                      return (
                        <div
                          key={att.id}
                          className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                              {getFileFormatIcon(att.file_name, 'w-4 h-4')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{att.file_name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{sizeStr}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              onClick={() => handleOpenAttachment(att.id)}
                              disabled={isOpening}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              {isOpening ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                              <span>{isOpening ? '열기 중...' : '즉시 열기'}</span>
                            </button>

                            <button
                              onClick={() => handleDownloadAttachment(att.id)}
                              disabled={isDownloading}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-emerald-400" />}
                              <span>{isDownloading ? '저장 중...' : '다운로드'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 flex items-center justify-end bg-slate-950/60">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. WRITE / EDIT MODAL (최고 관리자 전용) */}
      {/* ========================================================================= */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <h3 className="font-['Outfit',sans-serif] text-base font-bold text-white">
                  {editingPostId ? '전략 자료 게시글 수정' : '신규 전략 자료 등록 (클라우드 공유)'}
                </h3>
              </div>
              <button
                onClick={() => !saving && setIsWriteModalOpen(false)}
                disabled={saving}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Form */}
            <form onSubmit={handleSavePost} className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {uploadStatusMsg && (
                <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-800 text-xs text-indigo-300 flex items-center space-x-2 animate-pulse">
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">자료 제목 *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 2026년 8월 상품의 정석_생/손보편"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">카테고리 분류</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="상품전략">상품전략</option>
                  <option value="비교분석표">비교분석표</option>
                  <option value="제안서양식">제안서양식</option>
                  <option value="영업이슈">영업이슈</option>
                  <option value="기타자료">기타자료</option>
                </select>
              </div>

              {/* Content */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">자료 설명 및 브리핑 내용</label>
                <textarea
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="자료에 대한 주요 요약이나 전달 사항을 입력하세요..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">공유 첨부파일 (PDF, PPT, 엑셀 등)</label>
                  <button
                    type="button"
                    onClick={handleSelectFiles}
                    disabled={saving}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>파일 추가</span>
                  </button>
                </div>

                {/* Existing Attachments in Edit mode */}
                {existingAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-slate-400 font-medium">기존 등록된 파일:</p>
                    {existingAttachments.map((att) => {
                      const isDeleted = deleteAttachmentIds.includes(att.id);
                      return (
                        <div
                          key={att.id}
                          className={'p-2.5 rounded-xl border flex items-center justify-between text-xs ' + 
                            (isDeleted ? 'bg-rose-950/30 border-rose-900/50 text-rose-400 line-through opacity-60' : 'bg-slate-950 border-slate-800 text-slate-200')}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {getFileFormatIcon(att.file_name, 'w-3.5 h-3.5 shrink-0')}
                            <span className="truncate">{att.file_name}</span>
                          </div>
                          {isDeleted ? (
                            <button
                              type="button"
                              onClick={() => setDeleteAttachmentIds(prev => prev.filter(id => id !== att.id))}
                              className="text-[10px] text-indigo-400 hover:underline shrink-0"
                            >
                              삭제 취소
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteAttachmentIds(prev => [...prev, att.id])}
                              className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                              title="삭제 예정으로 표시"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* New Attachments to upload */}
                {newAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-emerald-400 font-medium">새로 추가할 파일 (업로드 대기):</p>
                    {newAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-xs text-emerald-200 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {getFileFormatIcon(att.name, 'w-3.5 h-3.5 shrink-0')}
                          <span className="truncate">{att.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({formatBytes(att.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Form Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{saving ? '클라우드 업로드 중...' : (editingPostId ? '수정 완료' : '등록 및 클라우드 배포')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// REAL PDF FIRST PAGE PREVIEW COMPONENT
function PdfFirstPagePreview({ attachmentId, fileName, postTitle, category }) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!attachmentId) {
      setLoading(false);
      return;
    }

    const loadThumb = async () => {
      try {
        if (api.board && api.board.getPdfThumbnail) {
          const res = await api.board.getPdfThumbnail(attachmentId);
          if (isMounted && res?.success && res.dataUrl) {
            setThumbUrl(res.dataUrl);
          }
        }
      } catch (err) {
        console.log('Thumbnail load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadThumb();
    return () => { isMounted = false; };
  }, [attachmentId]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-4 space-y-2">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        <span className="text-[10px] text-slate-500 font-mono">1페이지 렌더링 중...</span>
      </div>
    );
  }

  // If real thumbnail rendered successfully -> Show Actual PDF First Page Image
  if (thumbUrl) {
    return (
      <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
        <img 
          src={thumbUrl} 
          alt={postTitle} 
          className="w-full h-full object-cover object-top filter brightness-95 group-hover:brightness-105 group-hover:scale-105 transition-all duration-300"
        />
        {/* Subtle Page Badge on top-left */}
        <div className="absolute top-3 left-3 z-10">
          <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md bg-rose-600/90 text-white shadow-md flex items-center space-x-1">
            <FileText className="w-2.5 h-2.5" />
            <span>PDF 1P</span>
          </span>
        </div>
      </div>
    );
  }

  // Fallback Clean Graphic Document Cover
  return (
    <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-700/40 shadow-inner flex flex-col justify-between p-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 flex items-center space-x-1">
          <FileText className="w-2.5 h-2.5" />
          <span>PDF 1st PAGE</span>
        </span>
        <span className="text-[9px] font-mono font-bold text-slate-500">
          {category || '상품전략'}
        </span>
      </div>

      <div className="space-y-3 my-auto py-2 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500/20 via-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mx-auto shadow-md group-hover:scale-110 transition-transform">
          {getFileFormatIcon(fileName, 'w-6 h-6')}
        </div>
        <div className="space-y-1 px-1">
          <p className="text-[11px] font-black text-white line-clamp-2 leading-snug tracking-tight">
            {postTitle}
          </p>
          <p className="text-[9px] text-slate-400 font-mono truncate">
            {fileName}
          </p>
        </div>
        <div className="space-y-1 opacity-40 px-3">
          <div className="h-1 bg-slate-600 rounded-full w-full"></div>
          <div className="h-1 bg-slate-600 rounded-full w-4/5 mx-auto"></div>
          <div className="h-1 bg-slate-600 rounded-full w-2/3 mx-auto"></div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-500 font-mono">
        <span>ALPHA STRATEGY</span>
        <span>PAGE 1</span>
      </div>
    </div>
  );
}

function getFileFormatIcon(fileName, className = 'w-4 h-4') {
  if (!fileName) return <FileText className={className + ' text-indigo-400'} />;
  const ext = fileName.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    return <FileText className={className + ' text-rose-400'} />;
  } else if (ext === 'ppt' || ext === 'pptx') {
    return <Presentation className={className + ' text-amber-400'} />;
  } else if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return <FileSpreadsheet className={className + ' text-emerald-400'} />;
  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
    return <Image className={className + ' text-sky-400'} />;
  }
  return <File className={className + ' text-slate-400'} />;
}

function Presentation(props) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </svg>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getExt(fileName) {
  if (!fileName) return '';
  return fileName.split('.').pop().toLowerCase();
}
