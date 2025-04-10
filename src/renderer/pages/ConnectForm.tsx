/* eslint-disable react/jsx-props-no-spreading */
import {
  Button,
  CardContent,
  Container,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { ipcRenderer } from 'electron';
import { useSnackbar } from 'notistack';
import React, { FC, useEffect, useState } from 'react';
import { CheckCircle } from 'react-feather';
import { useParams } from 'react-router-dom';

import {
  GET_RECORDS,
  GET_UNIQUE_TAGS,
  SAVE_RECORD,
  TOAST_LENGTH,
  VIEW,
  VIEW_CONNECTION_LIST,
} from '../../shared/constants';
import { Connection, Protocol, Record, Selector } from '../../shared/pb/api';
import AdvancedConnectionSettings from '../components/AdvancedConnectionSettings';
import AdvancedSettingsAccordion from '../components/AdvancedSettingsAccordion';
import BeforeBackActionDialog from '../components/BeforeBackActionDialog';
import StyledCard from '../components/StyledCard';
import TagSelector from '../components/TagSelector';
import TextField from '../components/TextField';

interface Props {
  onComplete?: () => void;
}

const initialConnData: Connection = {
  name: undefined,
  protocol: Protocol.TCP,
  remoteAddr: '',
  listenAddr: undefined,
  pomeriumUrl: undefined,
  disableTlsVerification: false,
  caCert: undefined,
  clientCert: undefined,
  clientCertFromStore: undefined,
  autostart: false,
};

const ConnectForm: FC<Props> = () => {
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState<string>('');
  const [connection, setConnection] = useState(initialConnData);
  const [originalConnection, setOriginalConnection] = useState(initialConnData);
  const handleSubmit = (evt: React.FormEvent): void => {
    evt.preventDefault();
  };
  const { connectionID } = useParams();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    ipcRenderer.on(GET_RECORDS, (_, args) => {
      if (args.err) {
        enqueueSnackbar(args.err.message, {
          variant: 'error',
          autoHideDuration: TOAST_LENGTH,
        });
      } else if (args.res.records.length === 1) {
        setTags(args.res.records[0].tags || []);
        const { conn } = args.res.records[0];
        setConnection(conn || initialConnData);
        setOriginalConnection(conn || initialConnData);
        setSource(args.res.records[0].source);
      }
    });

    if (connectionID) {
      ipcRenderer.send(GET_RECORDS, {
        all: false,
        ids: [connectionID],
        tags: [],
      } as Selector);
    }
    return function cleanup() {
      ipcRenderer.removeAllListeners(GET_RECORDS);
      ipcRenderer.removeAllListeners(GET_UNIQUE_TAGS);
    };
  }, []);

  const saveName = (value: string): void => {
    setConnection({
      ...connection,
      ...{ name: value || undefined },
    });
  };

  const saveDestination = (value: string): void => {
    setConnection({
      ...connection,
      ...{ remoteAddr: value.trim() },
    });
  };

  const saveLocal = (value: string): void => {
    setConnection({
      ...connection,
      ...{ listenAddr: value.trim() || undefined },
    });
  };

  const handleClickBack = (): void => {
    if (JSON.stringify(originalConnection) !== JSON.stringify(connection)) {
      setShowBackWarning(true);
    } else {
      ipcRenderer.send(VIEW_CONNECTION_LIST);
    }
  };

  const handleChangeProtocol = (evt: SelectChangeEvent) => {
    setConnection((oldConnection) => {
      oldConnection.protocol =
        evt.target.value === 'UDP' ? Protocol.UDP : Protocol.TCP;
      return oldConnection;
    });
  };

  const saveConnection = (): void => {
    const record = {
      tags,
      conn: connection,
      source,
    } as Record;

    if (connectionID) {
      record.id = connectionID;
    }
    ipcRenderer.once(SAVE_RECORD, (_, args) => {
      if (args.err) {
        enqueueSnackbar(args.err.message, {
          variant: 'error',
          autoHideDuration: TOAST_LENGTH,
        });
      } else if (args.res) {
        ipcRenderer.send(VIEW, args.res.id);
      }
    });
    ipcRenderer.send(SAVE_RECORD, record);
  };

  const canSave = (): boolean => {
    if (connection?.clientCert?.cert && !connection?.clientCert?.key) {
      return false;
    }
    if (!!connection?.clientCert?.key && !connection?.clientCert?.cert) {
      return false;
    }
    return !!connection?.name && !!connection?.remoteAddr.trim();
  };

  return (
    <Container maxWidth={false} sx={{ pt: 4 }}>
      <BeforeBackActionDialog
        open={showBackWarning}
        onClose={() => setShowBackWarning(false)}
      />
      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <Grid>
            <Grid container alignItems="flex-start">
              <Grid item xs={12}>
                <Typography variant="h3" color="textPrimary">
                  {connectionID ? 'Edit' : 'Add'} Connection
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          <StyledCard>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Name"
                    value={connection?.name || ''}
                    onChange={(evt): void => saveName(evt.target.value)}
                    variant="outlined"
                    autoFocus
                    helperText="Name of the route."
                  />
                </Grid>{' '}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel id="protocol-label">Protocol</InputLabel>
                    <Select
                      labelId="protocol-label"
                      id="demo-simple-select"
                      value={
                        connection?.protocol === Protocol.UDP ? 'UDP' : 'TCP'
                      }
                      label="Age"
                      onChange={handleChangeProtocol}
                    >
                      <MenuItem value="TCP">TCP</MenuItem>
                      <MenuItem value="UDP">UDP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Destination"
                    value={connection?.remoteAddr}
                    onChange={(evt): void => saveDestination(evt.target.value)}
                    variant="outlined"
                    helperText="The remote address to connect to. Example: mysql.example.com:3306 or tcp+https://proxy.example.com/mysql.example.com:3306"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Local Address"
                    value={connection?.listenAddr || ''}
                    onChange={(evt): void => saveLocal(evt.target.value)}
                    variant="outlined"
                    helperText="The port or local address you want to connect to. Ex. :8888 or 127.0.0.1:8888"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={connection.autostart || false}
                        onChange={(evt) =>
                          setConnection({
                            ...connection,
                            autostart: evt.target.checked,
                          })
                        }
                        color="primary"
                      />
                    }
                    label="Start connection at app launch"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TagSelector tags={tags} onChangeTags={setTags} />
                </Grid>
              </Grid>
            </CardContent>
          </StyledCard>

          <AdvancedSettingsAccordion>
            <AdvancedConnectionSettings
              connection={connection}
              onChangeConnection={setConnection}
            />
          </AdvancedSettingsAccordion>

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              type="button"
              variant="contained"
              color="secondary"
              onClick={handleClickBack}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="contained"
              disabled={!canSave()}
              color="primary"
              onClick={saveConnection}
              endIcon={<CheckCircle />}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </form>
    </Container>
  );
};

export default ConnectForm;
