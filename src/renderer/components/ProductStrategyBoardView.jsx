import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Search, Plus, Download, Eye, Paperclip, Calendar, User, 
  Trash2, Edit, X, File, FileSpreadsheet, Image, AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Loader2, CloudUpload
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';
import { api } from '../utils/api';

export default function ProductStrategyBoardView() {
  const currentUser = useCrmStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.username === 'admin';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
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
        setIsDetailModalOpen(false);
        setIsWriteModalOpen(true);
      }
    } catch (err) {
      alert('수정 정보 로드 실패: ' + err.message);
    }
  };

  // Select files via native OS dialog
  const handleSelectFiles = async () => {
    try {
      const res = await api.board.selectFiles();
      if (res?.success && Array.isArray(res.files) && res.files.length > 0) {
        setNewAttachments(prev => [...prev, ...res.files]);
      }
    } catch (err) {
      console.error('File select error:', err);
    }
  };

  const handleRemoveNewAttachment = (index) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingAttachment = (attId) => {
    setDeleteAttachmentIds(prev => [...prev, attId]);
    setExistingAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Save Post (with Server Upload)
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('제목을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setFormError('');
    if (newAttachments.length > 0) {
      setUploadStatusMsg('첨부파일을 온라인 서버에 업로드하고 있습니다... (대용량 파일의 경우 수초 소요)');
    } else {
      setUploadStatusMsg('게시글을 서버에 저장 중입니다...');
    }

    try {
      if (editingPostId) {
        const res = await api.board.updatePost({
          id: editingPostId,
          title: formData.title.trim(),
          content: formData.content,
          category: formData.category,
          newAttachments,
          deleteAttachmentIds,
          currentUserId: currentUser?.id
        });
        if (res?.success) {
          setIsWriteModalOpen(false);
          await loadPosts();
        } else {
          setFormError(res?.error || '게시글 수정에 실패했습니다.');
        }
      } else {
        const res = await api.board.createPost({
          title: formData.title.trim(),
          content: formData.content,
          category: formData.category,
          attachments: newAttachments,
          currentUserId: currentUser?.id
        });
        if (res?.success) {
          setIsWriteModalOpen(false);
          await loadPosts();
        } else {
          setFormError(res?.error || '게시글 등록에 실패했습니다.');
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
      setUploadStatusMsg('');
    }
  };

  // Delete Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm('정말 이 게시글과 첨부파일을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.')) {
      return;
    }
    try {
      const res = await api.board.deletePost({ id: postId, currentUserId: currentUser?.id });
      if (res?.success) {
        setIsDetailModalOpen(false);
        await loadPosts();
      } else {
        alert(res?.error || '삭제 실패');
      }
    } catch (err) {
      alert('삭제 중 오류: ' + err.message);
    }
  };

  // Download Attachment (Server Stream Download)
  const handleDownloadAttachment = async (attId, fileName) => {
    setDownloadingId(attId);
    try {
      const res = await api.board.downloadAttachment(attId);
      if (res?.success && res.filePath) {
        alert('[' + fileName + '] 파일이 성공적으로 다운로드 저장되었습니다!\n저장 위치: ' + res.filePath);
      } else if (res?.error) {
        alert('다운로드 오류: ' + res.error);
      }
    } catch (err) {
      alert('다운로드 실패: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Open Attachment Directly (Server Stream Cache & Open)
  const handleOpenAttachment = async (attId) => {
    setOpeningId(attId);
    try {
      const res = await api.board.openAttachment(attId);
      if (res?.error) {
        alert('파일 열기 오류: ' + res.error);
      }
    } catch (err) {
      alert('파일 열기 실패: ' + err.message);
    } finally {
      setOpeningId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName = '') => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <Image className="w-4 h-4 text-sky-400" />;
    if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-rose-400" />;
    return <File className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="p-8 space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-['Outfit',sans-serif] text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
                <span>상품전략자료실</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center space-x-1">
                  <CloudUpload className="w-3 h-3" />
                  <span>서버 클라우드 공유</span>
                </span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Admin이 서버에 등록한 상품 비교 분석표, 제안서 양식, 상품 브리핑 자료를 전 조직원이 열람 및 다운로드할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={loadPosts}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="목록 새로고침"
          >
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>신규 자료 등록 (Admin)</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="자료 제목, 내용, 작성자 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-semibold">
          총 <strong className="text-indigo-400 font-bold">{posts.length}</strong>건의 전략 자료가 등록되어 있습니다.
        </div>
      </div>

      {/* Posts Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold">
                <th className="p-3.5 text-center w-16">번호</th>
                <th className="p-3.5">제목</th>
                <th className="p-3.5 text-center w-28">첨부파일</th>
                <th className="p-3.5 text-center w-28">작성자</th>
                <th className="p-3.5 text-center w-28">등록일</th>
                <th className="p-3.5 text-center w-20">조회</th>
                {isAdmin && <th className="p-3.5 text-right w-24">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="p-12 text-center text-slate-500 font-medium">
                    자료 목록을 불러오는 중입니다...
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="p-16 text-center text-slate-500 space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-slate-600 opacity-40" />
                    <p className="font-semibold text-xs">등록된 상품 전략 자료가 없습니다.</p>
                    {isAdmin && (
                      <p className="text-[11px] text-indigo-400 font-medium">
                        상단의 [신규 자료 등록] 버튼을 눌러 첫 상품 전략 자료를 공유해 보세요!
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                posts.map((post, idx) => {
                  const dateStr = post.created_at ? post.created_at.split('T')[0] : '-';
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
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-semibold">
                            {post.category || '상품전략'}
                          </span>
                          <span className="truncate max-w-md">{post.title}</span>
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

      {/* ========================================================================= */}
      {/* 1. DETAIL MODAL (모든 사용자 열람 및 첨부파일 다운로드) */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
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
                  <>
                    <button
                      onClick={() => handleOpenEditModal(selectedPost)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center space-x-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>수정</span>
                    </button>
                    <button
                      onClick={() => handleDeletePost(selectedPost.id)}
                      className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 text-xs font-bold rounded-xl border border-red-800/60 transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>삭제</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Attachments Download Card */}
              {postAttachments.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                    <Paperclip className="w-4 h-4 text-emerald-400" />
                    <span>서버 공유 첨부파일 ({postAttachments.length}개)</span>
                    <span className="text-[10px] text-slate-500 font-normal ml-2">
                      클릭하여 즉시 열람하거나 내 PC에 다운로드 저장할 수 있습니다.
                    </span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {postAttachments.map((att) => {
                      const isDownloading = downloadingId === att.id;
                      const isOpening = openingId === att.id;

                      return (
                        <div
                          key={att.id}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-indigo-500/50 flex items-center justify-between transition-all"
                        >
                          <div className="flex items-center space-x-2.5 overflow-hidden pr-2">
                            <div className="p-2 rounded-lg bg-slate-800 shrink-0">
                              {getFileIcon(att.file_name)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-white truncate" title={att.file_name}>
                                {att.file_name}
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono flex items-center space-x-1.5">
                                <span>{formatFileSize(att.file_size)}</span>
                                {att.download_url && (
                                  <span className="text-indigo-400 font-semibold">• 서버 저장됨</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              onClick={() => handleOpenAttachment(att.id)}
                              disabled={isOpening || isDownloading}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold border border-slate-700 transition-colors flex items-center space-x-1 disabled:opacity-50"
                              title="파일 즉시 열기"
                            >
                              {isOpening ? <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> : <ExternalLink className="w-3 h-3" />}
                              <span>{isOpening ? '열기 중' : '열기'}</span>
                            </button>
                            <button
                              onClick={() => handleDownloadAttachment(att.id, att.file_name)}
                              disabled={isOpening || isDownloading}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold shadow transition-colors flex items-center space-x-1 disabled:opacity-50"
                              title="파일 다운로드"
                            >
                              {isDownloading ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Download className="w-3 h-3" />}
                              <span>{isDownloading ? '저장 중' : '저장'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content text */}
              <div className="prose prose-invert max-w-none text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-medium p-2">
                {selectedPost.content || '내용이 없습니다.'}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>ALPHA CRM • 상품전략자료실 (온라인 서버 실시간 공유)</span>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WRITE / EDIT MODAL (Admin Only) */}
      {/* ========================================================================= */}
      {isWriteModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-['Outfit',sans-serif] text-lg font-bold text-white">
                  {editingPostId ? '상품 전략 자료 수정 (Admin)' : '신규 상품 전략 자료 등록 (Admin)'}
                </h3>
              </div>
              <button
                onClick={() => setIsWriteModalOpen(false)}
                disabled={saving}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSavePost} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              {formError && (
                <div className="p-3 bg-red-950/60 border border-red-800 text-red-400 rounded-xl font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {uploadStatusMsg && (
                <div className="p-3 bg-indigo-950/80 border border-indigo-700 text-indigo-300 rounded-xl font-bold flex items-center space-x-2 animate-pulse">
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  자료 제목 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: [2026 8월] 상품의 정석 및 주요 보종별 비교표"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={saving}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-bold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  상세 설명 및 본문 내용
                </label>
                <textarea
                  rows={8}
                  placeholder="자료에 대한 브리핑, 핵심 요약, 활용 방법 등을 입력하세요..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  disabled={saving}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed custom-scrollbar font-medium disabled:opacity-50"
                />
              </div>

              {/* Attachments Upload Field */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-300 flex items-center space-x-1">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                    <span>서버 공유 첨부파일 등록 (PDF, PPT, 엑셀, 이미지 등)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectFiles}
                    disabled={saving}
                    className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/50 rounded-xl font-bold transition-all flex items-center space-x-1.5 hover:scale-105 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>파일 선택 (PC에서 찾기)</span>
                  </button>
                </div>

                {/* Existing Attachments (when editing) */}
                {existingAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500 font-bold">기존 첨부파일:</p>
                    {existingAttachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <div className="flex items-center space-x-2 truncate">
                          {getFileIcon(att.file_name)}
                          <span className="truncate font-medium text-slate-200">{att.file_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({formatFileSize(att.file_size)})</span>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemoveExistingAttachment(att.id)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                          title="파일 삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* New Attachments */}
                {newAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-emerald-400 font-bold">서버에 업로드할 신규 파일 ({newAttachments.length}개):</p>
                    {newAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                        <div className="flex items-center space-x-2 truncate">
                          {getFileIcon(att.name)}
                          <span className="truncate font-medium text-white">{att.name}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">({formatFileSize(att.size)})</span>
                        </div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemoveNewAttachment(idx)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                          title="제거"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{saving ? '서버 업로드 및 저장 중...' : (editingPostId ? '수정 완료' : '서버에 자료 등록')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
