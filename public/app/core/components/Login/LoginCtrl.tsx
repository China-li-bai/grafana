import React, { PureComponent } from 'react';

import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';

import { LoginDTO } from './types';

const isOauthEnabled = () => {
  return !!config.oauth && Object.keys(config.oauth).length > 0;
};

export interface FormModel {
  user: string;
  password: string;
  email: string;
}

interface Props {
  resetCode?: string;

  children: (props: {
    isLoggingIn: boolean;
    changePassword: (pw: string) => void;
    isChangingPassword: boolean;
    skipPasswordChange: Function;
    login: (data: FormModel) => void;
    disableLoginForm: boolean;
    disableUserSignUp: boolean;
    isOauthEnabled: boolean;
    loginHint: string;
    passwordHint: string;
    showDefaultPasswordWarning: boolean;
  }) => JSX.Element;
}

interface State {
  isLoggingIn: boolean;
  isChangingPassword: boolean;
  showDefaultPasswordWarning: boolean;
}

export class LoginCtrl extends PureComponent<Props, State> {
  result: LoginDTO | undefined;

  constructor(props: Props) {
    super(props);
    this.state = {
      isLoggingIn: false,
      isChangingPassword: false,
      showDefaultPasswordWarning: false,
    };

    if (config.loginError) {
      appEvents.emit(AppEvents.alertWarning, ['Login Failed', config.loginError]);
    }
  }

  changePassword = (password: string) => {
    const pw = {
      newPassword: password,
      confirmNew: password,
      oldPassword: 'admin',
    };

    if (this.props.resetCode) {
      const resetModel = {
        code: this.props.resetCode,
        newPassword: password,
        confirmPassword: password,
      };

      getBackendSrv()
        .post('/api/user/password/reset', resetModel)
        .then(() => {
          this.toGrafana();
        });
    } else {
      getBackendSrv()
        .put('/api/user/password', pw)
        .then(() => {
          this.toGrafana();
        })
        .catch((err) => console.error(err));
    }
  };

  login = (formModel: FormModel) => {
    this.setState({
      isLoggingIn: true,
    });

    getBackendSrv()
      .post<LoginDTO>('/login', formModel)
      .then((result) => {
        this.result = result;
        if (formModel.password !== 'admin' || config.ldapEnabled || config.authProxyEnabled) {
          this.toGrafana();
          return;
        } else {
          this.changeView(formModel.password === 'admin');
        }
      })
      .catch(() => {
        this.setState({
          isLoggingIn: false,
        });
      });
  };

  changeView = (showDefaultPasswordWarning: boolean) => {
    this.setState({
      isChangingPassword: true,
      showDefaultPasswordWarning,
    });
  };

  toGrafana = () => {
    // Use window.location.href to force page reload
    if (this.result?.redirectUrl) {
      if (config.appSubUrl !== '' && !this.result.redirectUrl.startsWith(config.appSubUrl)) {
        window.location.assign(config.appSubUrl + this.result.redirectUrl);
      } else {
        window.location.assign(this.result.redirectUrl);
      }
    } else {
      window.location.assign(config.appSubUrl + '/');
    }
  };

  render() {
    const { children } = this.props;
    const { isLoggingIn, isChangingPassword, showDefaultPasswordWarning } = this.state;
    const { login, toGrafana, changePassword } = this;
    const { loginHint, passwordHint, disableLoginForm, disableUserSignUp } = config;

    return (
      <>
        {children({
          isOauthEnabled: isOauthEnabled(),
          loginHint,
          passwordHint,
          disableLoginForm,
          disableUserSignUp,
          login,
          isLoggingIn,
          changePassword,
          skipPasswordChange: toGrafana,
          isChangingPassword,
          showDefaultPasswordWarning,
        })}
      </>
    );
  }
}

export default LoginCtrl;
