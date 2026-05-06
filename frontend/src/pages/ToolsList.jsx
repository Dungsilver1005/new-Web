import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToastContext } from "../context/ToastContext";
import { Modal } from "../components/Modal";
import { RequestToolModal } from "../components/RequestToolModal";
import { ToolForm } from "../components/ToolForm";
import { toolService } from "../services/toolService";
import { toolRequestService } from "../services/toolRequestService";
import "./ToolsList.css";

export const ToolsList = () => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const { isAdmin, user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    location: "",
    category: "",
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  useEffect(() => {
    fetchTools();
    if (!isAdmin && user) {
      fetchPendingRequests();
    }
  }, [filters, isAdmin, user]);

  // Refresh pending requests when modal closes
  useEffect(() => {
    if (!showRequestModal && !isAdmin && user) {
      fetchPendingRequests();
    }
  }, [showRequestModal, isAdmin, user]);

  const fetchPendingRequests = async () => {
    try {
      const response = await toolRequestService.getRequests({
        status: "pending",
      });
      if (response.success) {
        setPendingRequests(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  };

  const [cabinetStatus, setCabinetStatus] = useState({
    totalSlots: 0,
    totalItems: 0,
    countsByName: {},
    isStrictFull: false
  });

  const fetchTools = async () => {
    setLoading(true);
    try {
      const backendFilters = { ...filters };

      // Map quick filter chips
      if (activeFilter === "available") {
        backendFilters.isInUse = "false";
        backendFilters.location = "warehouse";
        delete backendFilters.status;
      } else if (activeFilter === "in_use") {
        backendFilters.isInUse = "true";
        delete backendFilters.status;
      } else if (activeFilter === "maintenance") {
        backendFilters.location = "maintenance";
        delete backendFilters.status;
      } else if (activeFilter === "broken") {
        backendFilters.status = "unusable";
        delete backendFilters.location;
      }

      // Map filter status từ UI sang backend
      if (backendFilters.status === "available") {
        backendFilters.isInUse = "false";
        backendFilters.location = "warehouse";
        delete backendFilters.status;
      } else if (backendFilters.status === "in_use") {
        backendFilters.isInUse = "true";
        delete backendFilters.status;
      } else if (backendFilters.status === "maintenance") {
        backendFilters.location = "maintenance";
        delete backendFilters.status;
      }

      const response = await toolService.getTools(backendFilters);
      if (response.success) {
        setTools(response.data || []);
        setPagination({
          total: response.total || 0,
          page: response.page || 1,
          pages: response.pages || 1,
        });

        // Calculate cabinet capacity (only once or on full tool lists)
        if (!filters.search && !filters.status && !filters.location && activeFilter === "all") {
          const allToolsResponse = await toolService.getTools({ limit: 1000 });
          if (allToolsResponse.success) {
            const allTools = allToolsResponse.data || [];
            const grouped = allTools.reduce((acc, t) => {
              const name = (t.name || "N/A").trim();
              acc[name] = (acc[name] || 0) + 1;
              return acc;
            }, {});

            let totalSlots = 0;
            let totalItems = 0;
            Object.values(grouped).forEach(count => {
              totalSlots += Math.ceil(count / 10);
              totalItems += count;
            });

            setCabinetStatus({
              totalSlots,
              totalItems,
              countsByName: grouped,
              isStrictFull: totalSlots >= 9 && totalItems >= 90
            });
          }
        }
      }
    } catch (err) {
      showError(
        err.response?.data?.message || "Có lỗi xảy ra khi tải danh sách dụng cụ"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    setActiveFilter("all");
  };

  const handleQuickFilter = (filter) => {
    setActiveFilter(filter);
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleCreateTool = async (formData) => {
    // Validation before creating
    if (cabinetStatus.totalSlots >= 9) {
      const toolName = (formData.name || "").trim();
      const currentCount = cabinetStatus.countsByName[toolName] || 0;

      if (currentCount === 0) {
        showError("Tủ đã đầy 9 ngăn. Không thể thêm sản phẩm mới!");
        return;
      }

      if (currentCount % 10 === 0) {
        showError("Sản phẩm đã đầy ngăn. Không thể thêm dụng cụ này!");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await toolService.createTool(formData);
      if (response.success) {
        showSuccess("Tạo dụng cụ thành công");
        setShowCreateModal(false);
        fetchTools();
      } else {
        showError(response.message || "Tạo dụng cụ thất bại");
      }
    } catch (err) {
      showError(err.response?.data?.message || "Có lỗi xảy ra khi tạo dụng cụ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestTool = (tool) => {
    setSelectedTool(tool);
    setShowRequestModal(true);
  };

  const handleRequestSuccess = () => {
    fetchPendingRequests();
    fetchTools();
  };

  const hasPendingRequest = (toolId, toolCode) => {
    return pendingRequests.some(
      (req) =>
        (req.tool && (req.tool._id === toolId || req.tool === toolId)) ||
        (req.toolCode && req.toolCode === toolCode)
    );
  };

  const canRequestTool = (tool) => {
    if (isAdmin) return false;
    // Cho phép user yêu cầu bất kỳ tool nào (vì có thể yêu cầu theo toolCode)
    // Chỉ kiểm tra xem đã có yêu cầu pending chưa
    if (hasPendingRequest(tool._id, tool.productCode)) return false;
    return true;
  };

  const getLastMaintenanceDate = (tool) => {
    if (!tool.history || tool.history.length === 0) return "--";
    const maintenanceEntries = tool.history.filter(
      (entry) => entry.action === "maintenance"
    );
    if (maintenanceEntries.length === 0) return "--";
    const lastMaintenance = maintenanceEntries.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )[0];
    return new Date(lastMaintenance.date).toLocaleDateString("vi-VN");
  };

  const getStatusBadge = (record) => {
    if (record.isInUse) {
      return (
        <span className="status-badge status-badge-blue">
          <span className="status-dot status-dot-blue"></span>
          Đang sử dụng
        </span>
      );
    }
    if (record.status === "unusable" || record.location === "disposed") {
      return (
        <span className="status-badge status-badge-red">
          <span className="status-dot status-dot-red"></span>
          Hỏng
        </span>
      );
    }
    if (record.location === "maintenance") {
      return (
        <span className="status-badge status-badge-amber">
          <span className="status-dot status-dot-amber"></span>
          Cần bảo trì
        </span>
      );
    }
    return (
      <span className="status-badge status-badge-green">
        <span className="status-dot status-dot-green"></span>
        Sẵn sàng
      </span>
    );
  };

  const getLocationText = (location) => {
    const locationMap = {
      warehouse: "Kho",
      in_use: "Đang sử dụng",
      maintenance: "Khu bảo trì",
      disposed: "Đã thanh lý",
    };
    return locationMap[location] || location;
  };

  const getToolIcon = (category) => {
    // Map category to icon
    if (category?.toLowerCase().includes("khoan")) return "handyman";
    if (category?.toLowerCase().includes("cnc"))
      return "precision_manufacturing";
    if (
      category?.toLowerCase().includes("cờ lê") ||
      category?.toLowerCase().includes("bộ")
    )
      return "build";
    if (category?.toLowerCase().includes("hàn")) return "flash_on";
    if (category?.toLowerCase().includes("thước")) return "square_foot";
    return "handyman";
  };

  const startIndex = (pagination.page - 1) * filters.limit + 1;
  const endIndex = Math.min(pagination.page * filters.limit, pagination.total);

  return (
    <div className="tools-list-page">
      <div className="tools-list-content">
        {/* Page Heading */}
        <div className="tools-list-header">
          <div className="header-info">
            <h1 className="page-title">Danh sách Dụng cụ</h1>
            <p className="page-subtitle">
              Quản lý toàn bộ vòng đời dụng cụ và thiết bị trong kho sản xuất
            </p>
          </div>
          <div className="header-actions-wrapper">
            {cabinetStatus.totalSlots >= 9 && isAdmin && (
              <div className="cabinet-full-warning">
                <span className="material-symbols-outlined">warning</span>
                {cabinetStatus.isStrictFull
                  ? `Tủ dụng cụ đã đầy (${cabinetStatus.totalItems}/90). Không thể thêm mới!`
                  : "Tủ đã dùng hết 9 ngăn. Chỉ được phép thêm các loại dụng cụ hiện có còn chỗ!"}
              </div>
            )}
            {isAdmin && (
              <button
                className={`btn-add-tool ${cabinetStatus.isStrictFull ? "btn-disabled" : ""}`}
                onClick={() => !cabinetStatus.isStrictFull && setShowCreateModal(true)}
                disabled={cabinetStatus.isStrictFull}
                title={cabinetStatus.isStrictFull ? "Tủ đã đầy" : "Thêm dụng cụ mới"}
              >
                <span className="material-symbols-outlined">add</span>
                <span>Thêm dụng cụ mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="filters-card">
          <div className="filters-row">
            {/* Search */}
            <div className="search-wrapper">
              <span className="material-symbols-outlined search-icon">
                search
              </span>
              <input
                className="search-input"
                type="text"
                placeholder="Tìm kiếm theo tên hoặc mã số..."
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            {/* Dropdown Filters */}
            <div className="filters-dropdowns">
              <div className="filter-select-wrapper">
                <span className="material-symbols-outlined filter-icon">
                  filter_alt
                </span>
                <select
                  className="filter-select"
                  value={filters.location || ""}
                  onChange={(e) =>
                    handleFilterChange("location", e.target.value)
                  }
                >
                  <option value="">Tất cả vị trí</option>
                  <option value="warehouse">Kho</option>
                  <option value="in_use">Đang sử dụng</option>
                  <option value="maintenance">Phòng bảo trì</option>
                </select>
                <span className="material-symbols-outlined dropdown-icon">
                  expand_more
                </span>
              </div>

              <div className="filter-select-wrapper">
                <span className="material-symbols-outlined filter-icon">
                  info
                </span>
                <select
                  className="filter-select"
                  value={filters.status || ""}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="available">Sẵn sàng</option>
                  <option value="in_use">Đang sử dụng</option>
                  <option value="maintenance">Bảo trì/Hỏng</option>
                </select>
                <span className="material-symbols-outlined dropdown-icon">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="quick-filters">
            <button
              className={`filter-chip ${activeFilter === "all" ? "active" : ""
                }`}
              onClick={() => handleQuickFilter("all")}
            >
              Tất cả
            </button>
            <button
              className={`filter-chip ${activeFilter === "available" ? "active" : ""
                }`}
              onClick={() => handleQuickFilter("available")}
            >
              <span className="chip-dot chip-dot-green"></span>
              Sẵn sàng
            </button>
            <button
              className={`filter-chip ${activeFilter === "in_use" ? "active" : ""
                }`}
              onClick={() => handleQuickFilter("in_use")}
            >
              <span className="chip-dot chip-dot-blue"></span>
              Đang sử dụng
            </button>
            <button
              className={`filter-chip ${activeFilter === "maintenance" ? "active" : ""
                }`}
              onClick={() => handleQuickFilter("maintenance")}
            >
              <span className="chip-dot chip-dot-amber"></span>
              Bảo trì
            </button>
            <button
              className={`filter-chip ${activeFilter === "broken" ? "active" : ""
                }`}
              onClick={() => handleQuickFilter("broken")}
            >
              <span className="chip-dot chip-dot-red"></span>
              Hỏng
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-card">
          <div className="table-wrapper">
            <table className="tools-table">
              <thead>
                <tr>
                  <th className="w-1/4">Tên dụng cụ</th>
                  <th>Mã dụng cụ</th>
                  <th>Vị trí</th>
                  <th>Lần bảo trì cuối</th>
                  <th>Tình trạng</th>
                  <th className="text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center loading-cell">
                      Đang tải...
                    </td>
                  </tr>
                ) : tools.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center empty-cell">
                      Không có dụng cụ nào
                    </td>
                  </tr>
                ) : (
                  tools.map((tool) => (
                    <tr key={tool._id} className="table-row">
                      <td>
                        <div className="tool-info-cell">
                          <div className="tool-icon-wrapper">
                            <span className="material-symbols-outlined">
                              {getToolIcon(tool.category)}
                            </span>
                          </div>
                          <div>
                            <Link
                              to={`/tools/${tool._id}`}
                              className="tool-name"
                            >
                              {tool.category || tool.name || "N/A"}
                            </Link>
                            <p className="tool-model">
                              {tool.characteristics?.model
                                ? `Model: ${tool.characteristics.model}`
                                : tool.name || "N/A"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="tool-code">{tool.productCode || "N/A"}</td>
                      <td>{getLocationText(tool.location)}</td>
                      <td>{getLastMaintenanceDate(tool)}</td>
                      <td>{getStatusBadge(tool)}</td>
                      <td className="text-right">
                        <div className="action-buttons">
                          <Link
                            to={`/tools/${tool._id}`}
                            className="action-btn"
                            title="Xem chi tiết"
                          >
                            <span className="material-symbols-outlined">
                              visibility
                            </span>
                          </Link>
                          {isAdmin && (
                            <>
                              <button
                                className="action-btn action-btn-edit"
                                onClick={() =>
                                  navigate(`/tools/${tool._id}?edit=true`)
                                }
                                title="Chỉnh sửa"
                              >
                                <span className="material-symbols-outlined">
                                  edit
                                </span>
                              </button>
                              <button
                                className="action-btn action-btn-delete"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Bạn có chắc muốn xóa dụng cụ này?"
                                    )
                                  ) {
                                    toolService
                                      .deleteTool(tool._id)
                                      .then(() => {
                                        showSuccess("Xóa dụng cụ thành công");
                                        fetchTools();
                                      });
                                  }
                                }}
                                title="Xóa"
                              >
                                <span className="material-symbols-outlined">
                                  delete
                                </span>
                              </button>
                            </>
                          )}
                          {!isAdmin && (
                            <>
                              {hasPendingRequest(tool._id, tool.productCode) ? (
                                <span className="pending-badge">
                                  Đã gửi yêu cầu
                                </span>
                              ) : (
                                <button
                                  className="action-btn action-btn-request"
                                  onClick={() => handleRequestTool(tool)}
                                  title="Yêu cầu sử dụng"
                                >
                                  <span className="material-symbols-outlined">
                                    add
                                  </span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="table-pagination">
            <p className="pagination-info">
              Hiển thị <span className="font-medium">{startIndex}</span> đến{" "}
              <span className="font-medium">{endIndex}</span> của{" "}
              <span className="font-medium">{pagination.total}</span> kết quả
            </p>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page === 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.pages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAdmin && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Thêm dụng cụ mới"
          size="large"
        >
          <ToolForm
            onSubmit={handleCreateTool}
            onCancel={() => setShowCreateModal(false)}
            loading={submitting}
          />
        </Modal>
      )}

      {!isAdmin && (
        <RequestToolModal
          open={showRequestModal}
          onClose={() => {
            setShowRequestModal(false);
            setSelectedTool(null);
          }}
          tool={selectedTool}
          onSuccess={handleRequestSuccess}
        />
      )}
    </div>
  );
};
