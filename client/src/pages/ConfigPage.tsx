import { Card, Typography, Button, Modal, Form, DatePicker, InputNumber, Space, Alert } from 'antd';
import { Link } from 'react-router-dom';
import { 
  SettingOutlined,
  CalendarOutlined, 
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  TableOutlined 
} from '@ant-design/icons';
import { LayoutContainer } from '../components/LayoutContainer';
import { MatchSimulationDashboard } from '../components/MatchSimulationDashboard';
import { useConfigPageLogic } from '../hooks/useConfigPageLogic';

const { Title, Text } = Typography;

export default function ConfigPage() {
  const {
    permissions,
    loading,
    caching,
    simulatingMatches,
    showSimulationDashboard,
    // Estados de calendario
    generating,
    generateModalVisible,
    deleteModalVisible,
    activeSeason,
    matchStats,
    // Mensajes de estado
    errorMessage,
    successMessage,
    setErrorMessage,
    setSuccessMessage,
    // Funciones existentes
    handleInitializeSystem,
    handleResetSystem,
    handleCacheAllCompetitions,
    handleSimulateNextMatchday,
    handleOpenSimulationDashboard,
    handleCloseSimulationDashboard,
    // Funciones de calendario
    handleShowGenerateModal,
    handleGenerateMatches,
    handleShowDeleteModal,
    handleDeleteAllMatches,
    setGenerateModalVisible,
    setDeleteModalVisible
  } = useConfigPageLogic();

  const [form] = Form.useForm();

  // Solo mostrar la página si el usuario es administrador
  if (!permissions.isAdmin) {
    return (
      <LayoutContainer>
        <div style={{ padding: '24px 16px' }}>
          <Card>
            <Text>No tienes permisos para acceder a esta página.</Text>
          </Card>
        </div>
      </LayoutContainer>
    );
  }

  return (
    <LayoutContainer>
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingOutlined />
            Panel de Administración
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Herramientas del sistema
          </Text>
        </div>

        {/* Card de Sistema */}
        <Card 
          title={<><DatabaseOutlined style={{ marginRight: 8 }} />Sistema</>}
          size="small"
          style={{ marginBottom: '16px' }}
        >
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px'
          }}>
            <Button 
              type="primary" 
              icon={<DatabaseOutlined />}
              loading={loading} 
              onClick={handleInitializeSystem}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              Inicializar
            </Button>
            
            <Button 
              danger 
              icon={<ReloadOutlined />}
              loading={loading} 
              onClick={handleResetSystem}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              Reset
            </Button>
          </div>
        </Card>

        {/* Card de Partidos */}
        <Card 
          title={<><CalendarOutlined style={{ marginRight: 8 }} />Partidos</>}
          size="small"
          style={{ marginBottom: '16px' }}
        >
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px'
          }}>
            <Button 
              type="primary" 
              icon={<CalendarOutlined />}
              onClick={handleShowGenerateModal}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              Generar Calendario
            </Button>
            
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleShowDeleteModal}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              Eliminar Partidos
            </Button>
            
            <Button 
              type="primary" 
              onClick={handleOpenSimulationDashboard}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px',
                backgroundColor: '#52c41a', 
                borderColor: '#52c41a'
              }}
            >
              ⚽ Simular
            </Button>
          </div>
        </Card>

        {/* Card de Competiciones */}
        <Card 
          title={<><TableOutlined style={{ marginRight: 8 }} />Competiciones</>}
          size="small"
        >
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '12px',
            marginBottom: '12px'
          }}>
            <Button 
              type="dashed" 
              icon={<TableOutlined />}
              loading={caching} 
              onClick={handleCacheAllCompetitions}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px'
              }}
            >
              Poblar Cache local con football-data
            </Button>
          </div>
          
          <Link to="/leagues">
            <Button 
              type="default" 
              block
              style={{ fontSize: '12px', height: '40px' }}
            >
              📊 Ver Ligas y Equipos de Caché (football-data)
            </Button>
          </Link>
        </Card>

          {/* Dashboard de Simulación */}
          <MatchSimulationDashboard
            visible={showSimulationDashboard}
            onClose={handleCloseSimulationDashboard}
            onSimulate={handleSimulateNextMatchday}
            loading={simulatingMatches}
          />

          {/* Modal para generar partidos */}
          <Modal
            title="Generar Calendario de Partidos"
            open={generateModalVisible}
            onCancel={() => {
              setGenerateModalVisible(false);
              setErrorMessage(null);
            }}
            footer={null}
          >
            {errorMessage && (
              <Alert
                message="Partidos ya existentes"
                description={
                  <>
                    {errorMessage}
                    {matchStats.totalMatches > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <Button 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            setGenerateModalVisible(false);
                            setDeleteModalVisible(true);
                          }}
                        >
                          Eliminar partidos existentes
                        </Button>
                      </div>
                    )}
                  </>
                }
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleGenerateMatches}
            >
              <Form.Item
                label="Fecha de inicio"
                name="startDate"
                tooltip="Si no se especifica, se usará la fecha de inicio de la temporada"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                label="Días entre jornadas"
                name="daysPerMatchday"
                initialValue={7}
                tooltip="Número de días entre cada jornada (por defecto 7 días = 1 semana)"
                rules={[
                  {
                    required: true,
                    message: 'Este campo es requerido'
                  },
                  {
                    type: 'number',
                    min: 1,
                    max: 30,
                    message: 'Debe ser un número entre 1 y 30'
                  }
                ]}
              >
                <InputNumber 
                  min={1} 
                  max={30}
                  placeholder="7"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <div style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setGenerateModalVisible(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={generating}
                  >
                    Generar Partidos
                  </Button>
                </Space>
              </div>
            </Form>
          </Modal>

          {/* Modal para confirmar eliminación de todos los partidos */}
          <Modal
            title="¿Eliminar todos los partidos?"
            open={deleteModalVisible}
            onCancel={() => {
              setDeleteModalVisible(false);
              setErrorMessage(null);
            }}
            onOk={handleDeleteAllMatches}
            okText="Sí, eliminar"
            okType="danger"
            cancelText="Cancelar"
          >
            {errorMessage && (
              <Alert
                message="Error"
                description={errorMessage}
                type="error"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            
            {successMessage && (
              <Alert
                message="Éxito"
                description={successMessage}
                type="success"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <p>Esta acción eliminará todos los partidos de la temporada activa. ¿Estás seguro?</p>
            {activeSeason && (
              <p><strong>Temporada: {activeSeason.name}</strong></p>
            )}
            <p><strong>Total de partidos a eliminar: {matchStats.totalMatches}</strong></p>
          </Modal>
      </div>
    </LayoutContainer>
  );
}
