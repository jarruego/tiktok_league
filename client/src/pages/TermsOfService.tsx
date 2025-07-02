import React from 'react';
import { LayoutContainer } from '../components/LayoutContainer';

const TermsOfService: React.FC = () => (
  <LayoutContainer>
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <h1>Términos de Servicio</h1>
      <p>Bienvenido a Soccer Legends, un juego social donde los usuarios compiten en una liga ficticia utilizando su cuenta de TikTok para iniciar sesión.</p>
      <h2>1. Aceptación de los Términos</h2>
      <p>Al crear una cuenta o utilizar Soccer Legends, aceptas estos Términos de Servicio. Si no estás de acuerdo, no utilices la aplicación.</p>
      <h2>2. Registro y Cuenta</h2>
      <p>Para participar, debes iniciar sesión con tu cuenta de TikTok. Eres responsable de mantener la confidencialidad de tu cuenta y de todas las actividades que ocurran bajo la misma.</p>
      <h2>3. Uso de la Aplicación</h2>
      <p>Soccer Legends es solo para fines de entretenimiento. No se permite el uso de la aplicación para actividades ilegales o no autorizadas.</p>
      <h2>4. Propiedad Intelectual</h2>
      <p>Todo el contenido y materiales de Soccer Legends son propiedad de sus respectivos dueños. No puedes copiar, modificar o distribuir ningún contenido sin permiso.</p>
      <h2>5. Cambios en los Términos</h2>
      <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Te notificaremos sobre cambios importantes a través de la aplicación.</p>
      <h2>6. Contacto</h2>
      <p>Si tienes preguntas sobre estos términos, contáctanos a través del soporte de la aplicación.</p>
    </div>
  </LayoutContainer>
);

export default TermsOfService;
