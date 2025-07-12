import React from 'react';
import { Card, Typography, Button, Modal, Form, Input, Alert, DatePicker, InputNumber, Space } from 'antd';
import { Link } from 'react-router-dom';
import { 
  SettingOutlined,
  CalendarOutlined, 
  DeleteOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  TableOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { LayoutContainer } from '../components/LayoutContainer';
import { MatchSimulationDashboard } from '../components/MatchSimulationDashboard';
import { useConfigPageLogic } from '../hooks/useConfigPageLogic';
import { leagueApi } from '../api/leagueApi';

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
    // Funciones existentes
    handleInitializeSystem,
    handleResetSystem,
    handleRunDatabaseSeed,
    handleCacheAllCompetitions,
    handleSimulateNextMatchday,
    handleSimulateAllPendingMatches,
    handleOpenSimulationDashboard,
    handleCloseSimulationDashboard,
    // Funciones de calendario
    handleShowGenerateModal,
    handleGenerateMatches,
    handleShowDeleteModal,
    handleDeleteAllMatches,
    setGenerateModalVisible,
    setDeleteModalVisible,
    // Recalcular standings
    handleRecalculateAllStandings,
    recalculating,
    // Nuevas funciones para gestión de temporada
    seasonComplete,
    checkingSeasonComplete,
    creatingNewSeason,
    handleCreateNewSeason,
    // Para botón de asignar descendidos tras playoffs
    assigningRelegated,
    handleAssignRelegatedTeamsToVacantSlots
  } = useConfigPageLogic();

  // Estado para modal de crear nueva temporada desde completada
  const [newSeasonModalVisible, setNewSeasonModalVisible] = React.useState(false);
  const [newSeasonName, setNewSeasonName] = React.useState('');
  const [newSeasonError, setNewSeasonError] = React.useState<string | null>(null);
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

  // Generar nombre automático de temporada
  const generateNextSeasonName = async () => {
    try {
      // @ts-ignore
      const seasons = await leagueApi.getAllSeasons();
      const nextNumber = (seasons?.length || 0) + 1;
      return `Temporada ${String(nextNumber).padStart(2, '0')}`;
    } catch {
      return 'Temporada 01';
    }
  };

  // Cuando se abre el modal, autogenerar el nombre
  React.useEffect(() => {
    if (newSeasonModalVisible) {
      generateNextSeasonName().then(name => {
        setNewSeasonName(name);
      });
    }
  }, [newSeasonModalVisible]);

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
              title="Inicializa el sistema de ligas y asigna automáticamente todos los equipos a ligas"
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
              title="Elimina standings, matches y asignaciones de equipos SOLO de la temporada activa. No borra equipos, ligas ni divisiones."
            >
              Reset Sistema
            </Button>
            
            <Button 
              type="default" 
              icon={<DatabaseOutlined />}
              loading={loading} 
              onClick={handleRunDatabaseSeed}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px',
                borderColor: '#1677ff',
                color: '#1677ff'
              }}
              title="Ejecuta el seed y asigna automáticamente todos los equipos a ligas en la temporada activa"
            >
              Ejecutar Seed
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
              type="default"
              icon={<ReloadOutlined />}
              loading={recalculating}
              onClick={handleRecalculateAllStandings}
              style={{
                height: '50px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                fontSize: '11px',
                backgroundColor: '#e6f7ff',
                borderColor: '#91d5ff',
                color: '#1890ff'
              }}
              title="Recalcula todas las posiciones y desempates de la temporada activa"
            >
              Recalcular Posiciones
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
            
            <Button 
              type="primary" 
              icon={<ThunderboltOutlined />}
              loading={simulatingMatches}
              onClick={handleSimulateAllPendingMatches}
              style={{ 
                height: '50px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center',
                fontSize: '11px',
                backgroundColor: '#ff7a00', 
                borderColor: '#ff7a00'
              }}
              title="Simula automáticamente TODOS los partidos pendientes de la temporada activa"
            >
              Simular Todo
            </Button>
          </div>
        </Card>

        {/* Card de Gestión de Temporada - Solo aparece si hay temporada activa */}
        {activeSeason && (seasonComplete || checkingSeasonComplete) && (
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SettingOutlined />
                <span>Gestión de Temporada</span>
                {seasonComplete?.readyForNewSeason && (
                  <span style={{ 
                    backgroundColor: '#52c41a', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    LISTA PARA NUEVA TEMPORADA
                  </span>
                )}
              </div>
            }
            size="small"
            style={{ marginBottom: '16px' }}
            loading={checkingSeasonComplete && !seasonComplete}
          >
            {checkingSeasonComplete && !seasonComplete ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text>Verificando estado de la temporada...</Text>
              </div>
            ) : seasonComplete ? (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: '8px',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#1890ff' }}>{seasonComplete.summary.promotions}</div>
                    <div>Ascensos</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#fff2e8', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#fa8c16' }}>{seasonComplete.summary.relegations}</div>
                    <div>Descensos</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f6ffed', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: '#52c41a' }}>{seasonComplete.summary.tournamentQualifiers}</div>
                    <div>Torneos</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', backgroundColor: seasonComplete.summary.pendingPlayoffs > 0 ? '#fff1f0' : '#f0f8ff', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: seasonComplete.summary.pendingPlayoffs > 0 ? '#ff4d4f' : '#1890ff' }}>
                      {seasonComplete.summary.pendingPlayoffs}
                    </div>
                    <div>Playoffs Pend.</div>
                  </div>
                </div>

                {seasonComplete.pendingIssues.length > 0 && (
                  <Alert
                    message="Problemas pendientes"
                    description={seasonComplete.pendingIssues.join(', ')}
                    type="warning"
                    showIcon
                    style={{ marginBottom: '12px', fontSize: '12px' }}
                  />
                )}

                {seasonComplete.readyForNewSeason ? (
                  <div>
                    <Alert
                      message="¡Temporada completada!"
                      description="Todos los partidos regulares y playoffs han terminado. Puedes crear una nueva temporada."
                      type="success"
                      showIcon
                      style={{ marginBottom: '12px' }}
                    />
                    {/* Botón para asignar descendidos tras playoffs, solo si no hay playoffs pendientes */}
                    {seasonComplete.summary.pendingPlayoffs === 0 && (
                      <Button
                        type="default"
                        style={{ width: '100%', marginBottom: 8 }}
                        loading={assigningRelegated}
                        onClick={handleAssignRelegatedTeamsToVacantSlots}
                      >
                        Asignar descendidos tras playoffs
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<CalendarOutlined />}
                      loading={creatingNewSeason}
                      onClick={() => setNewSeasonModalVisible(true)}
                      style={{ width: '100%' }}
                    >
                      Crear Nueva Temporada
                    </Button>
                  </div>
                ) : (
                  <Alert
                    message="Temporada en progreso"
                    description="Aún hay partidos o playoffs pendientes por completar."
                    type="info"
                    showIcon
                  />
                )}
              </div>
            ) : null}
          </Card>
        )}

        {/* Modal para crear nueva temporada desde completada */}
        <Modal
          title="Crear Nueva Temporada"
          open={newSeasonModalVisible}
          onCancel={() => {
            setNewSeasonModalVisible(false);
            setNewSeasonName('');
            setNewSeasonError(null);
          }}
          onOk={async () => {
            if (!newSeasonName.trim()) {
              setNewSeasonError('El nombre de la temporada es obligatorio');
              return;
            }
            
            try {
              await handleCreateNewSeason(newSeasonName.trim());
              setNewSeasonModalVisible(false);
              setNewSeasonName('');
              setNewSeasonError(null);
            } catch (error: any) {
              setNewSeasonError(error.message || 'Error creando nueva temporada');
            }
          }}
          okText="Crear Temporada"
          confirmLoading={creatingNewSeason}
          okButtonProps={{ disabled: !newSeasonName.trim() }}
        >
          <Form layout="vertical">
            <Form.Item 
              label="Nombre de la nueva temporada" 
              required
              help="Se creará automáticamente con los equipos ascendidos y descendidos, y se generará el calendario completo de partidos"
            >
              <Input 
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="Ej: Temporada 2024-25"
              />
            </Form.Item>
            
            {seasonComplete && (
              <div style={{ marginBottom: '16px' }}>
                <Text strong>Resumen de la transición:</Text>
                <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '12px' }}>
                  <li>{seasonComplete.summary.promotions} equipos ascenderán</li>
                  <li>{seasonComplete.summary.relegations} equipos descenderán</li>
                  <li>{seasonComplete.summary.tournamentQualifiers} equipos clasificados a torneos</li>
                  <li><strong>Se generará automáticamente el calendario completo de partidos</strong></li>
                </ul>
              </div>
            )}
            
            {newSeasonError && (
              <Alert message={newSeasonError} type="error" showIcon style={{ marginBottom: 8 }} />
            )}
          </Form>
        </Modal>

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
